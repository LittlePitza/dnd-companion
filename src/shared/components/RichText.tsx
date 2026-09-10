import { Fragment } from 'react'

/**
 * Renders the one piece of markup the content files need — `**emphasis**` —
 * without ever handing a string to `dangerouslySetInnerHTML`. Anything that is
 * not a delimiter is rendered as plain text, so content can never inject markup.
 */
export function RichText({ children, className }: { children: string; className?: string }) {
  const segments = children.split(/\*\*(.+?)\*\*/g)

  return (
    <p className={className}>
      {segments.map((segment, index) =>
        // Odd indexes are the captured groups, i.e. the emphasised runs.
        index % 2 === 1 ? (
          <strong key={index}>{segment}</strong>
        ) : (
          <Fragment key={index}>{segment}</Fragment>
        ),
      )}
    </p>
  )
}
