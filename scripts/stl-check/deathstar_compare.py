#!/usr/bin/env python3
"""Compare the Death Star example with the source STL: radii of the outer surface along the same directions.

  python3 -I scripts/stl-check/deathstar_compare.py dirs OUTDIR            writes OUTDIR/dirs.json
  node scripts/stl-check/deathstar_rays.cjs ROOT OUTDIR/dirs.json OUTDIR/example.json
  python3 -I scripts/stl-check/deathstar_compare.py compare STL OUTDIR     reads dirs.json and example.json

The STL (deathstar_1_5_10_5.stl, sha256 a1f8083f...1e1c) is not in the repository.
STL frame: sphere centre (0.19, 0.18, 160.0), z the polar axis, 497.7 m per unit at 160 km; the dish at
longitude -174.5 degrees. It is turned about the polar axis so that the dish lies at longitude 0 (the station's +x).
Station frame: y the polar axis, the dish axis in the x-y plane 27 degrees above +x.
Direction sets (each a little off the hemispheres' vertex meridians, where a ray meets shared edges):
  section  the plane through the poles and the dish axis, tilted 0.2 degrees, every 0.25 degrees
  trench   latitudes -3..3 degrees every 0.02 at longitude 93.3 (away from the dish)
  dish     angles 0..24 degrees from the dish axis every 0.5, sixteen azimuths about it
  grid     every 4 degrees of latitude and longitude (longitudes offset 1.3 degrees)
Output: summary.txt, one CSV per set, dish-profile.csv (medians about the axis), section.png, section-diff.png.
"""
import sys,os,json,struct,math
import numpy as np
rad=math.radians;AX=np.array([math.cos(rad(27)),math.sin(rad(27)),0.0]);R=80000.0
def unit(v):v=np.asarray(v,float);return v/np.linalg.norm(v)
def make_dirs(out):
    os.makedirs(out,exist_ok=True);t=rad(.2);sets={'section':[],'trench':[],'dish':[],'grid':[]}
    for i in range(1440):
        a=i*.25;sets['section'].append([a,list(unit([math.cos(rad(a))*math.cos(t),math.sin(rad(a)),math.cos(rad(a))*math.sin(t)]))])
    for i in range(301):
        la=-3+i*.02;lo=rad(93.3);sets['trench'].append([round(la,2),list(unit([math.cos(rad(la))*math.cos(lo),math.sin(rad(la)),math.cos(rad(la))*math.sin(lo)]))])
    e1=unit(np.cross([0,0,1],AX));e2=np.cross(AX,e1)
    for i in range(49):
        th=i*.5
        for j in range(16):
            az=rad(j*22.5+7);sets['dish'].append([th,j,list(unit(AX*math.cos(rad(th))+(e1*math.cos(az)+e2*math.sin(az))*math.sin(rad(th))))])
    for la in range(-86,87,4):
        for lo in range(0,360,4):
            l=rad(lo+1.3);sets['grid'].append([la,lo,list(unit([math.cos(rad(la))*math.cos(l),math.sin(rad(la)),math.cos(rad(la))*math.sin(l)]))])
    json.dump({'sets':sets},open(os.path.join(out,'dirs.json'),'w'));print('wrote',os.path.join(out,'dirs.json'),{k:len(v) for k,v in sets.items()})
def compare(stl,out):
    from PIL import Image,ImageDraw
    with open(stl,'rb') as f:
        f.read(80);n=struct.unpack('<I',f.read(4))[0];a=np.frombuffer(f.read(n*50),dtype=np.dtype([('n','<f4',3),('v','<f4',(3,3)),('a','<u2')]))
    V=a['v'].astype(np.float64)-np.array([.19,.18,160.0]);U=160000/321.5;lo0=rad(-174.5);c,s_=math.cos(-lo0),math.sin(-lo0)
    P=np.stack([V[...,0]*c-V[...,1]*s_,V[...,2],V[...,0]*s_+V[...,1]*c],axis=-1)*U
    cen=P.mean(axis=1);cd=cen/np.linalg.norm(cen,axis=1)[:,None]
    def radius(d):
        d=np.asarray(d,float);T=P[cd@d>math.cos(rad(1.2))]
        if not len(T):return None
        o=d*400000.0;D=-d;e1=T[:,1]-T[:,0];e2=T[:,2]-T[:,0];h=np.cross(D,e2);det=(e1*h).sum(1);ok=np.abs(det)>1e-9
        inv=np.where(ok,1/np.where(ok,det,1),0);sv=o-T[:,0];u=(sv*h).sum(1)*inv;q=np.cross(sv,e1);v=(q@D)*inv;t=(e2*q).sum(1)*inv
        hit=ok&(u>=-1e-9)&(v>=-1e-9)&(u+v<=1+1e-9)&(t>0)
        return float(400000.0-t[hit].min()) if hit.any() else None
    E=json.load(open(os.path.join(out,'example.json')))['sets'];lines=[]
    rows={k:[r[:-2]+[r[-1],radius(r[-2]),r[-2]] for r in v] for k,v in E.items()}   # labels..., example, stl, direction
    for k,v in rows.items():
        with open(os.path.join(out,k+'.csv'),'w') as f:
            f.write('labels...,example_m,stl_m\n')
            for r in v:f.write(','.join('' if x is None else (f'{x:.1f}' if isinstance(x,float) else str(x)) for x in r[:-1])+'\n')
    def stats(name,v,sel=None):
        d=np.array(sorted(r[-3]-r[-2] for r in v if r[-3] is not None and r[-2] is not None and (sel is None or sel(r))));n=len(d)
        if not n:lines.append(f'{name}: no samples');return
        lines.append(f"{name}: n={n}  example-STL  median {np.median(d):+.0f} m, 5%..95% {d[int(n*.05)]:+.0f}..{d[min(n-1,int(n*.95))]:+.0f} m, rms {math.sqrt((d*d).mean()):.0f} m, min {d[0]:+.0f} m, max {d[-1]:+.0f} m, beyond 1.5 km: {int((np.abs(d)>1500).sum())}")
    off=lambda r:math.degrees(math.acos(max(-1,min(1,float(np.dot(r[-1],AX))))));lat=lambda r:math.degrees(math.asin(max(-1,min(1,r[-1][1]))))
    skin=lambda r:off(r)>24 and abs(lat(r))>2
    stats('grid, skin (more than 24 deg from the dish axis, more than 2 deg from the equator)',rows['grid'],skin);stats('section, skin',rows['section'],skin)
    stats('dish, centre (0..6 deg from the axis)',rows['dish'],lambda r:r[0]<=6);stats('dish, 6..12 deg',rows['dish'],lambda r:6<r[0]<=12);stats('dish, 12..20 deg',rows['dish'],lambda r:12<r[0]<=20);stats('dish, rim zone (20..22 deg)',rows['dish'],lambda r:20<r[0]<=22);stats('just outside the rim (22..24 deg)',rows['dish'],lambda r:22<r[0]<=24)
    stats('trench section, floor (|lat| < 0.4 deg)',rows['trench'],lambda r:abs(r[0])<.4);stats('trench section, skin beside it (1..3 deg)',rows['trench'],lambda r:abs(r[0])>1)
    for nm,i in (('example',-3),('STL',-2)):
        la=[r[0] for r in rows['trench'] if r[i] is not None and r[i]<R-1600];lines.append(f"trench, {nm}: more than 1.6 km below the sphere between latitudes {min(la):+.2f} and {max(la):+.2f} deg = {(max(la)-min(la))*math.pi/180*R/1000:.2f} km wide" if la else f'trench, {nm}: not found')
    with open(os.path.join(out,'dish-profile.csv'),'w') as f:
        f.write('angle_from_axis_deg,stl_median_m,stl_min_m,stl_max_m,example_median_m\n')
        for th in sorted({r[0] for r in rows['dish']}):
            s=[r[-2] for r in rows['dish'] if r[0]==th and r[-2] is not None];e=[r[-3] for r in rows['dish'] if r[0]==th and r[-3] is not None]
            if s:f.write(f"{th},{np.median(s):.0f},{min(s):.0f},{max(s):.0f},{np.median(e) if e else float('nan'):.0f}\n")
    open(os.path.join(out,'summary.txt'),'w').write('\n'.join(lines)+'\n');print('\n'.join(lines))
    sec=rows['section'];S=1400;im=Image.new('RGB',(S,S),(12,14,18));d=ImageDraw.Draw(im);k=(S/2-40)/85000
    for i,col in ((-2,(90,160,255)),(-3,(255,170,60))):
        pts=[(S/2+r[i]*k*math.cos(rad(r[0])),S/2-r[i]*k*math.sin(rad(r[0]))) for r in sec if r[i] is not None];d.line(pts+pts[:1],fill=col,width=2 if i==-2 else 1)
    d.text((20,20),'section through the poles and the dish axis: STL blue, example orange (true scale)',fill=(220,220,220));im.save(os.path.join(out,'section.png'))
    W,H=1440,520;im=Image.new('RGB',(W,H),(12,14,18));d=ImageDraw.Draw(im);mid=H/2;sc=(H/2-30)/1500
    for yv in (-1000,-500,0,500,1000):d.line([(0,mid-yv*sc),(W,mid-yv*sc)],fill=(50,54,60));d.text((4,mid-yv*sc-12),f'{yv:+d} m',fill=(150,150,150))
    d.line([(r[0]*4,mid-max(-1500,min(1500,r[-3]-r[-2]))*sc) for r in sec if r[-3] is not None and r[-2] is not None],fill=(255,170,60),width=1)
    d.text((20,6),'example minus STL along the section, by angle from +x (dish axis at 27 deg); clipped at +-1500 m',fill=(220,220,220));im.save(os.path.join(out,'section-diff.png'))
if sys.argv[1]=='dirs':make_dirs(sys.argv[2])
else:compare(sys.argv[2],sys.argv[3])
