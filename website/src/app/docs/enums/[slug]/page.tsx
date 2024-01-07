"use client";
import { useSidebar } from "@/providers/SidebarProvider";
import Link from "next/link";
import { useState } from "react";
import { IoIosArrowDown } from "react-icons/io";
import { FaGithub } from "react-icons/fa";

export default function Page({ params }: { params: { slug: string } }) {

   const { enums } = useSidebar();
   const [showProps, setShowProps] = useState(true);
   const currentEnum = enums.find((enumerator) => enumerator.name == params.slug);

   if (!currentEnum) return (
      <div className="flex flex-grow justify-center items-center text-center">
         <h1>The resource you were looking for does not exist.</h1>
      </div>
   );

   return (
      <div className="flex flex-col flex-grow p-4 overflow-y-auto">
         <h1 className="font-bold mb-4">{params.slug}</h1>

         <div className="grid grid-cols-1 jumpto-container">
            <div className="flex flex-col mb-4">
               <button className="uppercase flex items-center gap-2 font-bold w-fit" onClick={() => setShowProps(!showProps)}><span className={`${showProps ? "rotate-0" : "-rotate-90"}`}><IoIosArrowDown /></span>Properties</button>
               <ul className="jumpto-wrapper">
                  {showProps && currentEnum.children?.map((child, key) => (
                     <li key={key}><Link href={`#${child.name}`} className="link">{child.name}</Link></li>
                  ))}
               </ul>
            </div>
         </div>
         <div>
            <h1 className="font-bold">Properties</h1>
            <ul className="flex flex-col gap-4 w-full">
               {currentEnum.children?.map((child, key) => (
                  <li id={child.name} className="p-4 rounded-md bg-card w-full relative" key={key}>
                     <Link href={child.sources[0].url} target="_blank" className="absolute right-3 link"><FaGithub /></Link>
                     <Link href={`#${child.name}`} className="link">{child.name}</Link>
                     <p>{child.comment ? child.comment.summary[0].text : "No Description."}</p>
                  </li>
               ))}
            </ul>
         </div>
      </div>
   )
}