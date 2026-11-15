import { useState } from 'react'
import type { JSX, KeyboardEvent } from 'react'
import { useT } from '../../i18n'
import type { QuestionViewProps } from './types'
import type { TilesQuestion } from '../../engine/types'
import '../../styles/lesson-input.css'

interface Tile {
  id: string
  text: string
}

export function TilesView(props: QuestionViewProps<TilesQuestion>): JSX.Element {
  const { question, disabled, judgement, onSubmit } = props
  const t = useT()
  const [tray, setTray] = useState<Tile[]>(() =>
    question.tiles.map((text, index) => ({ id: `tile-${index}`, text })),
  )
  const [answer, setAnswer] = useState<Tile[]>([])

  const moveTile = (id: string) => {
    if (disabled) return
    const tile = tray.find((item) => item.id === id)
    if (tile) {
      setTray((current) => current.filter((item) => item.id !== id))
      setAnswer((current) => [...current, tile])
      return
    }
    const answered = answer.find((item) => item.id === id)
    if (answered) {
      setAnswer((current) => current.filter((item) => item.id !== id))
      setTray((current) => [...current, answered])
    }
  }

  const clear = () => {
    if (disabled) return
    setTray((current) => [...current, ...answer])
    setAnswer([])
  }

  const submit = () => {
    if (disabled || answer.length === 0) return
    onSubmit({ kind: 'tiles', tiles: answer.map((tile) => tile.text) })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter') return
    const target = event.target
    if (target instanceof Element && (target.closest('[data-tile]') || target.closest('button'))) {
      return
    }
    event.preventDefault()
    submit()
  }

  const answerRowClass = [
    'li-answer-row',
    judgement ? (judgement.correct ? 'li-answer-row-success' : 'li-answer-row-danger') : '',
    judgement ? (judgement.correct ? 'kp-anim-bounce' : 'kp-anim-shake') : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <section className="li-view" onKeyDown={handleKeyDown}>
      <p className="li-prompt">{question.prompt}</p>
      <p className="li-instruction">{t('lesson.tiles.hint')}</p>
      <div className={answerRowClass} data-testid="li-answer-row">
        {answer.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className="button li-tile"
            data-tile="true"
            data-tile-id={tile.id}
            onClick={() => moveTile(tile.id)}
            disabled={disabled}
          >
            {tile.text}
          </button>
        ))}
      </div>
      <div className="li-tray" data-testid="li-tray">
        {tray.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className="button li-tile"
            data-tile="true"
            data-tile-id={tile.id}
            onClick={() => moveTile(tile.id)}
            disabled={disabled}
          >
            {tile.text}
          </button>
        ))}
      </div>
      <div className="li-actions">
        <button
          type="button"
          className="button li-clear"
          onClick={clear}
          disabled={disabled || answer.length === 0}
        >
          {t('lesson.tiles.clear')}
        </button>
        <button
          type="button"
          className="button li-check"
          onClick={submit}
          disabled={disabled || answer.length === 0}
        >
          {t('lesson.check')}
        </button>
      </div>
      {judgement && (
        <p className="li-judgement">
          {judgement.correct ? t('lesson.correct') : t('lesson.incorrect')}
        </p>
      )}
    </section>
  )
}
