
import HLSVideoPlayer from "@/components/HLSVideoPlayer";
import Link from 'next/link';


export default async function Home({ params }) {
    const streamKey = (await params).streamKey
    return (
        <>
            <Link href="/">
                <img src="/quiver.png" alt="Quiver" className="h-20 w-32" />
            </Link>
            <HLSVideoPlayer streamKey={streamKey} />
        </>
    )
}