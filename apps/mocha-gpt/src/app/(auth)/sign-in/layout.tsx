export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
