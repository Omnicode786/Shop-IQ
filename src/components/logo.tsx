import Link from "next/link";
import Image from "next/image";

export function Logo() {
  return (
    <Link href="/" className="inline-flex min-w-0 items-center" aria-label="ShopIQ home">
      <span className="shopiq-logo-glass flex h-12 w-[170px] shrink-0 items-center justify-center rounded-2xl px-3 py-2 sm:h-14 sm:w-[210px]">
        <Image
          src="/logo.png"
          alt="ShopIQ"
          width={1086}
          height={304}
          priority
          className="h-full w-full object-contain"
        />
      </span>
    </Link>
  );
}
