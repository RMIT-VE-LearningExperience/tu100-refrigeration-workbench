import type { Metadata } from 'next';
import './globals.css';
const title='TU-100 Digital Twin | Refrigeration Workbench';
const description='Explore, configure and measure the TU-100 refrigeration trainer. An interactive RMIT teaching emulator.';
export const metadata:Metadata={metadataBase:new URL('https://tu100-refrigeration-workbench.lawrence-makoona.chatgpt.site'),title,description,icons:{icon:'/favicon.svg'},openGraph:{title,description,type:'website',images:[{url:'/og.png',width:1733,height:907,alt:'TU-100 Digital Twin — The refrigeration workbench'}]},twitter:{card:'summary_large_image',title,description,images:['/og.png']}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
