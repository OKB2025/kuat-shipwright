"""Render one actual 4v4 trace. See README for the mesh exporter and rasterizer."""
import argparse
import base64
import ctypes as ct
import gzip
import json
import math
from pathlib import Path
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1280, 720, 30
BLUE, RED = '#66d5fc', '#ff917c'
TEAMS = (BLUE, RED)
GOLD, WHITE, MUTED = '#ffd568', '#f1f5fa', '#a8b9cb'
BG, PANEL, GRID = '#090f19', '#101b2a', '#233244'
FORM = {'tie_ln': 'TIE/ln', 'tie_in': 'TIE/in', 'tie_d': 'TIE/D'}
JP = '/usr/share/fonts/opentype/noto/NotoSansCJK-'
fonts = {}

def label(draw, xy, value, size=16, color=WHITE, bold=False, anchor=None):
    key = (size, bold)
    if key not in fonts:
        fonts[key] = ImageFont.truetype(JP + ('Bold' if bold else 'Regular') + '.ttc', size, index=0)
    draw.text(xy, str(value), font=fonts[key], fill=color, anchor=anchor, stroke_width=0)

def unit(v):
    return v / max(1e-9, np.linalg.norm(v))

def data_json(path):
    opener = gzip.open if path.suffix == '.gz' else open
    with opener(path, 'rt', encoding='utf-8') as f:
        return json.load(f)

def readable_id(index):
    return ('X' if index < 4 else 'T') + str(index % 4 + 1)

class Recording:
    def __init__(self, trace):
        self.frames = trace['frames']
        self.dt = trace['dt']
        self.ids = trace['ids']
        self.teams = np.array(trace['teams'])
        self.end = trace['result']['t']
        self.s = np.array([[row[:6] + (row[6:12] if len(row) >= 12 else
                           [math.cos(row[3]), 0, math.sin(row[3]), 0, 1, 0])
                           for row in frame['u']] for frame in self.frames])
        self.missiles = {}
        self.encounters = []
        self.plan = []
        target, switch, view = None, 0, None
        for i, frame in enumerate(self.frames):
            time = (i+1)*self.dt
            live = np.flatnonzero(self.s[i,:,4] == 0)
            pos = self.s[i,:,:3]
            for m in frame['m']:
                log = self.missiles.setdefault(m['id'], dict(first=i, points=[], target=self.ids.index(m['b']),
                                                              source=self.ids.index(m['a'])))
                log['points'].append(np.array(m['p']))
                assert i == log['first'] + len(log['points']) - 1
            if len(live) and (target not in live or time >= switch):
                side = int(time//6) % 2
                pool = [n for n in live if self.teams[n] == side]
                def distance(n):
                    foe = [v for v in live if self.teams[v] != self.teams[n]]
                    return min((np.linalg.norm(pos[n]-pos[v]) for v in foe), default=0)
                target = min(pool or list(live), key=distance)
                switch = time + 6
            self.encounters.append(target if target is not None else 0)
            pts = pos[live][:,[0,2]] if len(live) else pos[:,[0,2]]
            low, high = pts.min(axis=0), pts.max(axis=0)
            center = (high+low)/2
            span = max(1500, (high[0]-low[0])*1.2, (high[1]-low[1])*2.35)
            wanted = np.array([*center, span])
            view = wanted if view is None else .85*view + .15*wanted
            # Smooth the centre while keeping every living aircraft inside the plan window.
            spread = np.max(np.abs(pts-view[:2]),axis=0)
            view[2] = max(view[2],2.25*spread[0],4.55*spread[1])
            self.plan.append(view.copy())
        self.plan = np.array(self.plan)
        self.first_launch = min((v['first'] for v in self.missiles.values()), default=10**6)*self.dt + self.dt

    def sample(self, time):
        tick = min(len(self.frames)-1, max(0, time/self.dt-1))
        i = int(tick)
        j = min(i+1, len(self.frames)-1)
        a = tick-i
        state = (1-a)*self.s[i] + a*self.s[j]
        state[:,4:6] = self.s[i,:,4:6]
        active = []
        for mid, obj in self.missiles.items():
            offset = i-obj['first']
            pts = obj['points']
            if not 0 <= offset < len(pts):
                continue
            head = (1-a)*pts[offset] + a*pts[min(offset+1,len(pts)-1)]
            trail = pts[max(0,offset-8):offset+1] + [head]
            active.append((mid,obj,head,trail))
        return i,state,active,(1-a)*self.plan[i]+a*self.plan[j]

class Chase:
    def __init__(self, folder, names):
        self.mesh = ct.CDLL(str((folder/'raster.so').resolve())).mesh
        ptr = ct.c_void_p
        self.mesh.argtypes = [ptr,ptr,ct.c_int,ct.c_int,ptr,ptr,ct.c_int,ptr,ptr,ct.c_float]
        self.mesh.restype = None
        self.models = []
        for name in names:
            model = data_json(folder/'models'/(name+'.json'))
            def array(key, dtype):
                return np.frombuffer(base64.b64decode(model[key]), dtype)
            pos = array('pos','f4').reshape(-1,3)
            nor = array('nor','i1').reshape(-1,3)/127
            col = array('col','u1').reshape(-1,4)
            lighting = .64 + .36*np.maximum(0,nor@unit(np.array([.2,.9,-.3])))
            color = np.ascontiguousarray(np.clip(col[:,:3]*lighting[:,None]+.16*col[:,3:4],0,255),'u1')
            self.models.append((pos,color,model['len']))
        self.stars = np.random.default_rng(24).normal(size=(2600,3))
        self.stars /= np.linalg.norm(self.stars,axis=1)[:,None]

    def frame(self, s, subject, teams, missiles):
        w,h = 416,235
        focal = 380
        live = np.flatnonzero(s[:,4] == 0)
        facing = unit(s[subject,6:9])
        worldup = unit(.23*s[subject,9:12]+[0,.77,0])
        enemies = live[teams[live] != teams[subject]]
        target = min(enemies, key=lambda n: np.linalg.norm(s[n,:3]-s[subject,:3]), default=None)
        front = facing if target is None else unit(.56*facing+.44*unit(s[target,:3]-s[subject,:3]))
        right = unit(np.cross(front,worldup))
        length = self.models[teams[subject]][2]
        eye = s[subject,:3]+length*(-3.3*front+.48*worldup+.44*right)
        front = unit(s[subject,:3]+front*length*.9-eye)
        right = unit(np.cross(front,worldup))
        cam = np.array([right,unit(np.cross(right,front)),front])
        rgb = np.full((h,w,3),[8,14,23],dtype='u1')
        depth = np.zeros((h,w),'f4')
        stars = self.stars@cam.T
        stars = stars[stars[:,2]>.4]
        xx = (w/2+focal*stars[:,0]/stars[:,2]).astype(int)
        yy = (h/2-focal*stars[:,1]/stars[:,2]).astype(int)
        ok = (xx>=0)&(xx<w)&(yy>=0)&(yy<h)
        rgb[yy[ok],xx[ok]] = [125,145,163]
        def project(p):
            x,y,z = cam@(p-eye)
            if z < .6: return None
            return (w/2+focal*x/z,h/2-focal*y/z)
        markers = []
        for n in live:
            where = np.ascontiguousarray(cam@(s[n,:3]-eye),'f4')
            x,y,z = where
            if z<=.6 or abs(x)>z*.72+25 or abs(y)>z*.45+25: continue
            pos,colors,size = self.models[teams[n]]
            if z < 2500:
                forward = unit(s[n,6:9])
                side = unit(np.cross(forward,s[n,9:12]))
                rot = np.ascontiguousarray(cam@np.array([forward,unit(np.cross(side,forward)),side]).T,'f4')
                self.mesh(rgb.ctypes.data,depth.ctypes.data,w,h,pos.ctypes.data,colors.ctypes.data,
                          len(pos),rot.ctypes.data,where.ctypes.data,focal)
            if n != subject and z>size*12: markers.append((project(s[n,:3]),TEAMS[teams[n]]))
        result = Image.fromarray(rgb)
        draw = ImageDraw.Draw(result)
        for point,col in markers:
            if point:
                x,y=point
                draw.rectangle((x-3,y-3,x+3,y+3),outline=col)
        for _,_,head,trail in missiles:
            xy=project(head)
            line=[project(p) for p in trail]
            for a,b in zip(line,line[1:]):
                if a and b and all(abs(t)<10000 for t in (*a,*b)): draw.line((a,b),fill=GOLD,width=2)
            if xy and 0<=xy[0]<w and 0<=xy[1]<h:
                x,y=xy;draw.ellipse((x-3,y-3,x+3,y+3),fill=GOLD)
        return result

def tactical(rec, state, i, active, view, side=False):
    w,h = 794,137 if side else 400
    im=Image.new('RGB',(w,h),PANEL); d=ImageDraw.Draw(im)
    cx,cz,span=view
    if side:
        alt=rec.s[:,:,1]; low,high=alt.min()-200,alt.max()+200
        def project(p): return ((p[0]-cx)*w/span+w/2,h-12-(p[1]-low)*(h-24)/(high-low))
        zero=project([cx,0,0])[1];d.line((0,zero,w,zero),fill='#45596b')
        label(d,(w-8,min(h-26,max(2,zero-24))),'開始高度',13,MUTED,anchor='ra')
    else:
        def project(p): return ((p[0]-cx)*w/span+w/2,(p[2]-cz)*w/span+h/2)
        step = 1000 if span>4500 else 500 if span>2300 else 250
        for u in range(math.floor((cx-span*.5)/step),math.ceil((cx+span*.5)/step)+1):
            x=project([u*step,0,cz])[0]; d.line((x,0,x,h),fill=GRID)
        for v in range(math.floor((cz-span*h/(2*w))/step),math.ceil((cz+span*h/(2*w))/step)+1):
            y=project([cx,0,v*step])[1];d.line((0,y,w,y),fill=GRID)
        bar=w*step/span
        d.line((14,h-14,14+bar,h-14),fill=MUTED,width=2)
        label(d,(14,h-39),str(step)+' m',13,MUTED)
    for n,u in enumerate(state):
        history=rec.s[max(0,i-(18 if side else 30)):i+1,n]
        livehistory=history[history[:,4]==0]
        traj=[project(p) for p in livehistory]
        if u[4]==0: traj.append(project(u))
        if len(traj)>1:d.line(traj,fill=('#396e8a','#995f61')[rec.teams[n]],width=2)
    for _,_,head,trail in active:
        if len(trail)>1:d.line([project(v) for v in trail],fill='#d89c43',width=2)
        x,y=project(head); r=3 if side else 4
        d.polygon([(x,y-r),(x+r,y),(x,y+r),(x-r,y)],fill=GOLD)
    for n,u in enumerate(state):
        x,y=project(u);col=TEAMS[rec.teams[n]]
        if u[4]:
            if rec.s[max(i-3,0),n,4]==0:
                d.line((x-5,y-5,x+5,y+5),fill=col,width=2);d.line((x-5,y+5,x+5,y-5),fill=col,width=2)
            continue
        if side:
            d.ellipse((x-3,y-3,x+3,y+3),fill=col); continue
        angle=math.atan2(u[8],u[6])
        def tip(a,r): return (x+r*math.cos(a),y+r*math.sin(a))
        d.polygon([tip(angle,8),tip(angle+2.6,6),tip(angle-2.6,6)],fill=col)
        label(d,(x+7,y-15),readable_id(n),13,col,True)
    return im

def missile_panel(draw, pos, active, launched):
    x,y=846,424
    label(draw,(x,y),'ミサイル追跡',17,GOLD,True)
    if not active:
        label(draw,(x,y+38),'飛翔中のミサイルなし',16,MUTED)
    else:
        mid,m,head,trail=max(active,key=lambda item:len(item[3]))
        target=pos[m['target'],:3]
        label(draw,(x,y+33),f"{mid.upper()}   {readable_id(m['source'])} → {readable_id(m['target'])}     {np.linalg.norm(target-head):,.0f} m",16)
        # The inset projects all three spatial axes; the scale follows this missile and target.
        projection=np.array([[.80,-.22],[0,-.92],[-.60,-.30]])
        pts=np.array(trail+[target])@projection
        lo,hi=pts.min(axis=0),pts.max(axis=0)
        pts=(pts-(hi+lo)/2)*min(350/max(50,hi[0]-lo[0]),48/max(50,hi[1]-lo[1]))+[x+194,y+92]
        if len(pts)>2:draw.line(list(map(tuple,pts[:-1])),fill=GOLD,width=3)
        a,b=pts[-2];draw.ellipse((a-4,b-4,a+4,b+4),fill=GOLD)
        a,b=pts[-1];draw.rectangle((a-5,b-5,a+5,b+5),outline=TEAMS[int(m['target']>=4)],width=2)
    label(draw,(x,y+128),f'飛翔中 {len(active)}    累計発射 {launched}',14,MUTED)

def status(draw,state):
    for team,heading in enumerate(('Xウィング','TIE')):
        x=846+team*204
        label(draw,(x,596),heading,15,TEAMS[team],True)
        for j in range(4):
            n=team*4+j;xx=x+j*46
            u=state[n];label(draw,(xx,627),readable_id(n),13,TEAMS[team] if not u[4] else MUTED)
            if u[4]:
                label(draw,(xx,650),'撃墜',13,MUTED)
            elif u[5]<0:
                label(draw,(xx,650),'なし',13,MUTED)
            else:
                v=max(0,min(1,u[5]))
                draw.rectangle((xx,660,xx+34,665),fill=GRID)
                if v>0:draw.rectangle((xx,660,xx+34*v,665),fill=TEAMS[team])

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('trace',type=Path);parser.add_argument('assets',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    trace=data_json(args.trace);rec=Recording(trace)
    chase=Chase(args.assets,[trace['a'],trace['b']])
    tie=trace['b'].removeprefix('craft_');op=FORM[tie]
    out=args.output;out.parent.mkdir(parents=True,exist_ok=True)
    cmd=['ffmpeg','-v','error','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{W}x{H}',
         '-framerate',str(FPS),'-i','-','-an','-c:v','libx264','-threads','2','-preset','veryfast',
         '-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(out)]
    with subprocess.Popen(cmd,stdin=subprocess.PIPE) as pipe:
        time=rec.dt;finished=0
        while finished<2*FPS:
            i,s,missiles,view=rec.sample(time)
            rate=1 if rec.first_launch-1 <= time < rec.first_launch+4 else 4
            im=Image.new('RGB',(W,H),BG);d=ImageDraw.Draw(im)
            label(d,(22,13),f'Xウィング  対  {op}',32,WHITE,True)
            label(d,(24,65),'4 対 4  ／  8 km 対向  ／  シード 24',16,MUTED)
            label(d,(810,26),f'経過 {time:05.1f} 秒',23,WHITE,True,anchor='ra')
            label(d,(1258,21),f'X  {sum(s[:4,4]==0)}/4     {op}  {sum(s[4:,4]==0)}/4',23,WHITE,True,anchor='ra')
            label(d,(1258,64),'終了' if time>=rec.end else f'再生 ×{rate}',15,MUTED,anchor='ra')
            d.rectangle((22,102,816,133),fill=GRID);label(d,(32,103),'上面からの航跡',16,WHITE,True)
            label(d,(799,104),'▲  Xウィング',15,BLUE,anchor='ra')
            label(d,(645,104),'▲  '+op,15,RED,anchor='ra')
            label(d,(519,104),'◆  ミサイル',15,GOLD,anchor='ra')
            im.paste(tactical(rec,s,i,missiles,view),(22,134))
            d.rectangle((22,545,816,575),fill=GRID)
            label(d,(32,546),'側面からの航跡',16,WHITE,True)
            label(d,(800,547),'高度は開始地点からの差',14,MUTED,anchor='ra')
            im.paste(tactical(rec,s,i,missiles,view,True),(22,576))
            d.rectangle((832,102,1259,403),fill=PANEL)
            sub=rec.encounters[i]
            label(d,(847,110),'3D 追尾カメラ',18,WHITE,True)
            label(d,(1246,111),readable_id(sub)+'   '+('Xウィング' if sub<4 else op),16,TEAMS[int(sub>=4)],anchor='ra')
            im.paste(chase.frame(s,sub,rec.teams,missiles),(838,152))
            d.rectangle((832,412,1259,575),fill=PANEL)
            launches=sum(track['first']<=i for track in rec.missiles.values())
            missile_panel(d,s,missiles,launches)
            d.rectangle((832,582,1259,713),fill=PANEL)
            status(d,s);label(d,(846,683),'各機のシールド残量',14,MUTED)
            if time>=rec.end:
                lost=trace['result'];surv_x=4-lost['lostA'];surv_t=4-lost['lostB']
                winner='相討ち' if surv_x==surv_t==0 else '引き分け' if surv_x==surv_t else ('Xウィング' if surv_x>surv_t else op)+' 勝利'
                d.rounded_rectangle((51,179,444,279),radius=8,fill='#101e2b',outline='#7390a5',width=2)
                label(d,(70,188),winner,27,WHITE,True);label(d,(70,238),f'生存   Xウィング {surv_x} 機   ／   {op} {surv_t} 機',16,MUTED)
                finished+=1
            pipe.stdin.write(im.tobytes())
            time=min(rec.end,time+rate/FPS)
        pipe.stdin.close()
        if pipe.wait():raise RuntimeError('ffmpeg failed')

if __name__=='__main__':
    main()
