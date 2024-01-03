import Link from "next/link";

export default function Navbar() {
    return (
        <>
            <div className="hidden h-14 w-full md:flex justify-between items-center px-8 text-lg border-b">
                <div className="flex gap-12 items-center">
                    <Link href={'/'} className="font-bold">strafe.js</Link>
                    <Link href={"/docs"}>Documentation</Link>
                    <Link href={"/guide"}>Guide</Link>
                </div>
            </div>
            <div className="flex h-14 w-full md:hidden justify-between items-center px-8 text-lg border-b">
                <Link href={'/'} className="font-bold">strafe.js</Link>
                <span>More</span>
            </div>
        </>
    )
}