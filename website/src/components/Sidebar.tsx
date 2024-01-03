"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Sidebar() {

    const pathname = usePathname();
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (pathname == "/docs") setShow(true);
        else setShow(false);
    }, [pathname]);

    return (
        <>
            {show && (
                <div>
                    test
                </div>
            )}
        </>
    )
}