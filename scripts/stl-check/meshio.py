import numpy as np,struct,zipfile,re,sys
def load(p):
    if p.lower().endswith('.3mf'):
        z=zipfile.ZipFile(p);tris=[]
        for n in z.namelist():
            if not n.lower().endswith('.model'):continue
            x=z.read(n).decode('utf8','replace')
            for obj in re.finditer(r'<mesh>(.*?)</mesh>',x,re.S):
                m=obj.group(1)
                V=np.array([[float(a),float(b),float(c)] for a,b,c in re.findall(r'<vertex[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*z="([^"]+)"',m)])
                T=np.array([[int(a),int(b),int(c)] for a,b,c in re.findall(r'<triangle[^>]*v1="(\d+)"[^>]*v2="(\d+)"[^>]*v3="(\d+)"',m)])
                if len(T):tris.append(V[T])
        return np.concatenate(tris) if tris else np.zeros((0,3,3))
    b=open(p,'rb').read()
    n=struct.unpack('<I',b[80:84])[0] if len(b)>=84 else 0
    if len(b)==84+n*50:
        a=np.frombuffer(b[84:84+n*50],dtype=np.dtype([('n','<3f4'),('v','<9f4'),('a','<u2')]));return a['v'].reshape(-1,3,3).astype(float)
    v=[list(map(float,l.split()[1:4])) for l in b.decode('latin1').splitlines() if l.strip().startswith('vertex')]
    return np.array(v).reshape(-1,3,3)
if __name__=='__main__':
    for p in sys.argv[1:]:
        t=load(p);v=t.reshape(-1,3);mn,mx=v.min(0),v.max(0)
        print(p.split('/')[-1],'tris',len(t),'min',mn.round(2),'max',mx.round(2),'size',(mx-mn).round(2))
