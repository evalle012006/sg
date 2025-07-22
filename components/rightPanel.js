export default function RightPanel(props) {
  const { children, show } = props;

  return (
    <div className="h-full bg-zinc-100 top-0 right-0 w-full border-2 border-zinc-200">
      {children}
    </div>
  );
}