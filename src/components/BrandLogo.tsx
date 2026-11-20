interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className = 'w-9 h-9' }: BrandLogoProps) {
  return (
    <img
      src="./icon-192x192.png"
      alt="Ikon Materi N4 N5 by Minna"
      width={36}
      height={36}
      referrerPolicy="no-referrer"
      className={`${className} rounded-xl object-cover shadow-xs ring-1 ring-black/10 dark:ring-white/15 select-none`}
    />
  );
}
