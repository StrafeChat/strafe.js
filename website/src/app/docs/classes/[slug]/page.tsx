"use client";
import { useSidebar } from "@/providers/SidebarProvider";
import { Class, Enum, Property } from "@/types";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FaGithub } from "react-icons/fa";
import { IoIosArrowDown } from "react-icons/io";

export default function Page({ params }: { params: { slug: string } }) {

    const { classes } = useSidebar();
    const currentClass = classes.find((clazz) => clazz.name == params.slug);

    const [showProps, setShowProps] = useState(true);
    const [showMethods, setShowMethods] = useState(true);

    const [properties, setProperties] = useState<Property[]>([]);
    const [methods, setMethods] = useState<any[]>([]);

    const init = useCallback(() => {
        setProperties([]);
        setMethods([]);
        if (currentClass) {
            for (const child of currentClass.children) {
                switch (child.kind) {
                    case 1024:
                        if (!child.flags.isPrivate) setProperties((prev) => [...prev, child as Property]);
                        break;
                    case 2048:
                        if (!child.flags.isPrivate) setMethods((prev) => [...prev, child]);
                        break;
                }
            }
        }
    }, [currentClass]);

    useEffect(() => {
        init();
    }, [currentClass, init]);

    const MapType = ({ data, type }: { data: Property, type: "property" | "method" }) => {

        let resultArr: string[] = [];

        switch (type) {
            case "property":
                switch (data.type.type) {
                    case "union":
                        for (const type of data.type.types!) {
                            switch (type.type) {
                                case "literal":
                                    resultArr.push(`${type.value!}`);
                                case "intrinsic":
                                    console.log(type.name);
                                    resultArr.push(type.name!);
                                    break;
                            }
                        }
                        break;
                }
                break;
        }
        return resultArr.map((result, key) => <Link href={""} key={key} >{result}</Link>);
    }

    if (!currentClass) return (
        <div className="flex flex-grow justify-center items-center text-center">
            <h1>The resource you were looking for does not exist.</h1>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-56px)] p-4 overflow-y-auto flex-grow">
            <h1 className="font-bold">{params.slug}</h1>
            {/* {(() => {
                console.log(currentClass.children[0])
                return <></>
            })()} */}

            <div className="grid grid-cols-1 md:grid-cols-2 jumpto-container">
                {properties.length > 0 && <div className="flex flex-col mb-4">
                    <button className="uppercase flex items-center gap-2 font-bold w-fit" onClick={() => setShowProps(!showProps)}><span className={`${showProps ? "rotate-0" : "-rotate-90"}`}><IoIosArrowDown /></span>Properties</button>
                    <ul className="jumpto-wrapper">
                        {showProps && properties.map((prop, key) => (
                            <li key={key}><Link href={`#${prop.name}`} className="link">{prop.name}</Link></li>
                        ))}
                    </ul>
                </div>}
                {methods.length > 0 && <div className="flex flex-col mb-4">
                    <button className="uppercase flex items-center gap-2 font-bold w-fit" onClick={() => setShowMethods(!showMethods)}><span className={`${showProps ? "rotate-0" : "-rotate-90"}`}><IoIosArrowDown /></span>Methods</button>
                    <ul className="jumpto-wrapper">
                        {showMethods && methods.map((meth, key) => (
                            <li key={key}><Link href={`#${meth.name}`} className="link">{meth.name}</Link></li>
                        ))}
                    </ul>
                </div>}
            </div>
            {properties.length > 0 && (
                <>
                    <h1 className="font-bold">Properties</h1>
                    <ul className="flex flex-col gap-4 w-full">
                        {properties.map((prop, key) => (
                            <li id={prop.name} className="p-4 rounded-md bg-card w-full relative" key={key}>
                                <Link href={prop.sources[0].url} target="_blank" className="absolute right-3 link"><FaGithub /></Link>
                                <Link href={`#${prop.name}`} className="link">{prop.name}</Link>
                                <p>{prop.comment ? prop.comment.summary[0].text : "No Description."}</p>
                                <p className="font-bold">Type: <MapType data={prop} type="property" /></p>
                            </li>
                        ))}
                    </ul>
                </>
            )}
            {methods.length > 0 && (
                <>
                    <h1 className={`font-bold ${properties.length > 0 && "mt-4"}`}>Methods</h1>
                    <ul className="flex flex-col gap-4 w-full">
                        {methods.map((meth, key) => (
                            <li id={meth.name} key={key} className="p-4 rounded-md bg-card w-full relative">
                                <Link href={meth.sources[0].url} target="_blank" className="absolute right-3 link"><FaGithub /></Link>
                                <Link href={`#${meth.name}`} className="link">{meth.name}()</Link>
                                <p>{meth.comment ? meth.comment.summary[0].text : "No Description."}</p>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    )
}