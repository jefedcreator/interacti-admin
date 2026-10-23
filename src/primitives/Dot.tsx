/** The landing's status marker: filled for live, hollow for coming soon. Say the word beside it. */
export function Dot({ live }: { live: boolean }) {
  return <span aria-hidden="true" className={live ? 'dot' : 'dot dot--soon'} />;
}
