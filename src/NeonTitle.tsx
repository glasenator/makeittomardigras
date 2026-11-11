type Props = { flickeringLetters?: number[] }

function NeonTitle({ flickeringLetters = [] }: Props) {
  return (
    <em>
      <span className="sr-only">Mardi Gras</span>
      <span className="neon-title" aria-hidden="true">
        {Array.from('Mardi Gras').map((character, index) => (
          <span className={`neon-letter neon-letter-${index % 3}${flickeringLetters.includes(index) ? ' flickering-off' : ''}`} key={`${character}-${index}`}>{character === ' ' ? '\u00a0' : character}</span>
        ))}
      </span>
    </em>
  )
}

export default NeonTitle
