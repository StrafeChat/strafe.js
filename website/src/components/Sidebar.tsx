"use client";
import { useSidebar } from "@/providers/SidebarProvider";
import { SidebarButton } from "@/types";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export default function Sidebar() {

    const { open, setOpen, classes, enums } = useSidebar();
    const ref = useRef<HTMLDivElement>(null);
    const [showClasses, setShowClasses] = useState(false);
    const [showEnums, setShowEnums] = useState(false);

    const handleClickOutside = useCallback((event: MouseEvent) => {
        if (ref.current && !ref.current.contains(event.target as Node)) setOpen(2);
    }, [setOpen]);

    useEffect(() => {
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, [handleClickOutside]);

    const toggleActive = (tab: SidebarButton) => {
        switch (tab) {
            case "class":
                setShowClasses(!showClasses);
                break;
            case "enum":
                setShowEnums(!showEnums);
                break;
        }
    }

    return (
        <div className={`w-fit flex flex-col min-h-full ${open < 1 ? "hidden" : "flex flex-col"}`} ref={ref}>
            <button className={`${open > 1 ? "block" : "hidden"} absolute md:hidden p-2 bg-green-500 rounded-b-lg rounded-r-lg rounded-t-lg rounded-l-none mt-4`} onClick={() => setOpen(1)}>test</button>
            <div className={`${open == 1 ? "flex" : "hidden md:flex"} w-60 md:w-72 bg-sidebar flex-col pt-4 px-4 overflow-y-auto select-none min-h-full`}>
                <button className="uppercase font-bold w-fit" onClick={() => toggleActive("class")}>Classes</button>
                {showClasses && classes.map((clazz, key) => (
                    <Link href={`/docs/classes/${clazz.name}`} key={key}>{clazz.name}</Link>
                ))}
                <button className="uppercase font-bold w-fit" onClick={() => toggleActive("enum")}>Enums</button>
                {showEnums && enums.map((enumerator, key) => (
                    <Link href={`/docs/enums/${enumerator.name}`} key={key}>{enumerator.name}</Link>
                ))}
            </div>
        </div>
    )
}