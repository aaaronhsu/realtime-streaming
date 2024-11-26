'use client'

import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'

export default function Home() {
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
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