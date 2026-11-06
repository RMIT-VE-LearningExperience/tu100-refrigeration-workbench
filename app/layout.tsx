import type { Metadata } from 'next';
import './globals.css';
import { asset } from '@/lib/base';
const title='TU-100 Digital Twin | Refrigeration Workbench';
const description='Explore, configure and measure the TU-100 refrigeration trainer. An interactive RMIT teaching emulator.';
export const metadata:Metadata={metadataBase:new URL(process.env.SITE_URL ?? 'https://tu100-refrigeration-workbench.lawrence-makoona.chatgpt.site'),title,description,icons:{icon:asset('/favicon.svg')},openGraph:{title,description,type:'website',images:[{url:asset('/og.png'),width:1733,height:907,alt:'TU-100 Digital Twin — The refrigeration workbench'}]},twitter:{card:'summary_large_image',title,description,images:[asset('/og.png')]}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
