'use client'

import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'

export default function Home() {
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log(e.target[0].value);
    router.push(`/stream/${e.target[0].value}`);
  }

  return (
    <>
      <img src="/quiver.png" alt="Quiver" className="h-20 w-32" />
      <form onSubmit={handleSubmit}>
        <input type="text" className="border border-1 border-black m-2 w-100" />
        <button type="submit"> 
          <FontAwesomeIcon icon={faMagnifyingGlass} />
        </button>
      </form>
    </>
  );
}
// k8s server: "http://34.75.81.163:8080/hls/test.m3u8"
// reg server: http://35.188.2.50:8080/hls/test.m3u8