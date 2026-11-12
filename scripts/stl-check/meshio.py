import numpy as np,struct,zipfile,re,sys
def load(p):
    if p.lower().endswith('.3mf'):
        # 3MF: objects hold a mesh or components; components and build items carry 3x4 transforms
        # (row vector convention: p' = [x y z 1] @ M). Every build item is placed in the file's frame.
        z=zipfile.ZipFile(p);x=z.read([n for n in z.namelist() if n.lower().endswith('.model')][0]).decode('utf8','replace')
        def mat(t):
            if not t: return np.eye(4)
            v=list(map(float,t.split()));M=np.eye(4);M[:3,:3]=np.array(v[:9]).reshape(3,3);M[3,:3]=v[9:12];return M
        objs={}
        for m in re.finditer(r'<object\s+([^>]*)>(.*?)</object>',x,re.S):
            oid=re.search(r'id="(\d+)"',m.group(1)).group(1);body=m.group(2)
            mesh=re.search(r'<mesh>(.*?)</mesh>',body,re.S)
            if mesh:
                V=np.array([[float(a),float(b),float(c)] for a,b,c in re.findall(r'<vertex[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*z="([^"]+)"',mesh.group(1))])
                T=np.array([[int(a),int(b),int(c)] for a,b,c in re.findall(r'<triangle[^>]*v1="(\d+)"[^>]*v2="(\d+)"[^>]*v3="(\d+)"',mesh.group(1))])
                objs[oid]=('mesh',V[T] if len(T) else np.zeros((0,3,3)))
            else:
                objs[oid]=('comp',[(c[0],mat(c[1])) for c in re.findall(r'<component\s+objectid="(\d+)"(?:\s+transform="([^"]*)")?',body)])
        def flat(oid,M):
            kind,d=objs[oid]
            if kind=='mesh':
                P=np.concatenate([d.reshape(-1,3),np.ones((d.size//3,1))],1)@M;return [P[:,:3].reshape(-1,3,3)]
            out=[]
            for cid,CM in d: out+=flat(cid,CM@M)
            return out
        build=re.search(r'<build>(.*?)</build>',x,re.S).group(1);tris=[]
        for oid,t in re.findall(r'<item\s+objectid="(\d+)"(?:[^>]*?transform="([^"]*)")?',build): tris+=flat(oid,mat(t))
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
