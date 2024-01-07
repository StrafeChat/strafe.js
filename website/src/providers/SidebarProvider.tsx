"use client";
import Sidebar from "@/components/Sidebar";
import { Class, Enum, SidebarProps } from "@/types";
import { usePathname } from "next/navigation";
import { ReactNode, createContext, useContext, useEffect, useRef, useState } from "react";
import docs from "../../docs.json";

export const SidebarContext = createContext({} as SidebarProps);

export default function SidebarProvider({ children }: { children: ReactNode }) {

    const [open, setOpen] = useState(0);
    const pathname = usePathname();
    const activeRef = useRef<boolean>(false);

    const [classes, setClasses] = useState<Class[]>([]);
    const [enums, setEnums] = useState<Enum[]>([]);

    useEffect(() => {
        if (pathname.startsWith("/docs")) setOpen(1);
        else setOpen(0);
    }, [pathname]);

    useEffect(() => {
        if (!activeRef.current) {
            for (const child of docs.children) {
                switch (child.kind) {
                    case 8:
                        setEnums((prev) => [...prev, child as Enum]);
                        break;
                    case 128:
                        setClasses((prev) => [...prev, child as Class]);
                        break;
                }
            }
        }
        activeRef.current = true;
    }, []);

    return (
        <SidebarContext.Provider value={{ open, classes, enums, setOpen }}>
            <Sidebar />
            {children}
        </SidebarContext.Provider>
    )
}

export const useSidebar = () => useContext(SidebarContext);