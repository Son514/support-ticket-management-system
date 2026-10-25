import Image from "next/image";

export function AuthHero() {
  return (
    <div className="relative hidden bg-muted md:block">
      <Image
        src="/images/login-signup.webp"
        alt=""
        fill
        priority
        sizes="(min-width: 768px) 50vw, 100vw"
        className="object-cover dark:brightness-[0.2] dark:grayscale"
      />
    </div>
  );
}
