import numpy as np,struct,sys
def load(p):
    b=open(p,'rb').read()
    if b[:5]==b'solid' and b'facet' in b[:400]:
        v=[list(map(float,l.split()[1:4])) for l in b.decode('latin1').splitlines() if l.strip().startswith('vertex')]
        return np.array(v).reshape(-1,3,3)
    n=struct.unpack('<I',b[80:84])[0];a=np.frombuffer(b[84:84+n*50],dtype=np.dtype([('n','<3f4'),('v','<9f4'),('a','<u2')]));return a['v'].reshape(-1,3,3).astype(float)
if __name__=='__main__':
    for p in sys.argv[1:]:
        t=load(p);v=t.reshape(-1,3);mn,mx=v.min(0),v.max(0)
        print(p.split('/')[-1],len(t),'min',mn.round(2),'max',mx.round(2),'size',(mx-mn).round(2))
