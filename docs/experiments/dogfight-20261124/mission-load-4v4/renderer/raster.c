#include <math.h>
#include <stdint.h>
void mesh(uint8_t* rgb,float* depth,int w,int h,float* v,uint8_t* colors,int count,float* m,float* org,float focal){
 for(int j=0;j<count;j+=3){float x[3],y[3],z[3];int invisible=0;
 for(int k=0;k<3;k++){float*a=v+(j+k)*3;float b[3];for(int c=0;c<3;c++)b[c]=org[c]+m[c*3]*a[0]+m[c*3+1]*a[1]+m[c*3+2]*a[2];if(b[2]<.5f){invisible=1;break;}z[k]=1/b[2];x[k]=w*.5f+b[0]*focal*z[k];y[k]=h*.5f-b[1]*focal*z[k];}if(invisible)continue;
 int x0=fmaxf(0,floorf(fminf(x[0],fminf(x[1],x[2])))),x1=fminf(w-1,ceilf(fmaxf(x[0],fmaxf(x[1],x[2])))),y0=fmaxf(0,floorf(fminf(y[0],fminf(y[1],y[2])))),y1=fminf(h-1,ceilf(fmaxf(y[0],fmaxf(y[1],y[2]))));
 float det=(y[1]-y[2])*(x[0]-x[2])+(x[2]-x[1])*(y[0]-y[2]);if(fabsf(det)<.02f)continue;
 for(int iy=y0;iy<=y1;iy++)for(int ix=x0;ix<=x1;ix++){float px=ix+.5f-x[2],py=iy+.5f-y[2],a=((y[1]-y[2])*px+(x[2]-x[1])*py)/det,b=((y[2]-y[0])*px+(x[0]-x[2])*py)/det,c=1-a-b;if(a<0||b<0||c<0)continue;float dz=a*z[0]+b*z[1]+c*z[2];int q=iy*w+ix;if(dz<=depth[q])continue;depth[q]=dz;for(int l=0;l<3;l++)rgb[3*q+l]=colors[3*j+l];}
 }}
