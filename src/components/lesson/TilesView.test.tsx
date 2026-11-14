import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TilesView } from './TilesView'
import { I18nProvider } from '../../i18n'
import type { TilesQuestion } from '../../engine/types'

const question: TilesQuestion = {
  format: 'tiles',
  itemId: 'word-1',
  prompt: 'I like cats',
  tiles: ['like', 'cats', 'I'],
  answer: ['I', 'like', 'cats'],
  accepted: [],
}

function renderTilesView(props: Partial<Parameters<typeof TilesView>[0]> = {}) {
  const onSubmit = vi.fn()
  const view = (
    <I18nProvider>
      <TilesView
        question={question}
        disabled={false}
        judgement={null}
        onSubmit={onSubmit}
        {...props}
      />
    </I18nProvider>
  )
  render(view)
  return { onSubmit }
}

function getAnswerRowTexts(): string[] {
  const row = screen.getByTestId('li-answer-row')
  return Array.from(row.querySelectorAll('[data-tile]')).map((el) => el.textContent ?? '')
}

function getTrayTexts(): string[] {
  const tray = screen.getByTestId('li-tray')
  return Array.from(tray.querySelectorAll('[data-tile]')).map((el) => el.textContent ?? '')
}

describe('TilesView', () => {
  it('タイルを順にクリックして解答の行が並ぶ', async () => {
    renderTilesView()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'I' }))
    await user.click(screen.getByRole('button', { name: 'like' }))
    await user.click(screen.getByRole('button', { name: 'cats' }))

    expect(getAnswerRowTexts(), `期待: ${JSON.stringify(['I', 'like', 'cats'])}`).toEqual([
      'I',
      'like',
      'cats',
    ])
    expect(getTrayTexts(), `期待: ${JSON.stringify([])}`).toEqual([])
  })

  it('解答の行のタイルをクリックして戻る', async () => {
    renderTilesView()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'I' }))
    await user.click(screen.getByRole('button', { name: 'I' }))

    expect(getAnswerRowTexts(), `期待: ${JSON.stringify([])}`).toEqual([])
    expect(getTrayTexts(), `期待: ${JSON.stringify(['like', 'cats', 'I'])}`).toEqual([
      'like',
      'cats',
      'I',
    ])
  })

  it('同じ語のタイルが2つあっても別々に動く', async () => {
    const duplicateQuestion: TilesQuestion = {
      format: 'tiles',
      itemId: 'word-2',
      prompt: 'a a',
      tiles: ['a', 'a'],
      answer: ['a', 'a'],
      accepted: [],
    }
    renderTilesView({ question: duplicateQuestion })
    const user = userEvent.setup()

    const buttons = screen.getAllByRole('button', { name: 'a' })
    expect(buttons, `期待: 2`).toHaveLength(2)
    const first = buttons[0]
    const second = buttons[1]
    if (!first || !second) {
      throw new Error('duplicate tiles are missing')
    }

    await user.click(first)
    await user.click(second)
    expect(getAnswerRowTexts(), `期待: ${JSON.stringify(['a', 'a'])}`).toEqual(['a', 'a'])

    const answerButtons = screen.getAllByRole('button', { name: 'a' })
    const answerFirst = answerButtons[0]
    if (!answerFirst) {
      throw new Error('answer tile is missing')
    }
    await user.click(answerFirst)
    expect(getAnswerRowTexts(), `期待: ${JSON.stringify(['a'])}`).toEqual(['a'])
    expect(getTrayTexts(), `期待: ${JSON.stringify(['a'])}`).toEqual(['a'])
  })

  it('確認で tiles 回答が1回送られる', async () => {
    const { onSubmit } = renderTilesView()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'I' }))
    await user.click(screen.getByRole('button', { name: 'like' }))
    await user.click(screen.getByRole('button', { name: 'cats' }))
    await user.click(screen.getByRole('button', { name: '答え合わせ' }))

    expect(onSubmit, `入力: ${JSON.stringify(['I', 'like', 'cats'])}`).toHaveBeenCalledTimes(1)
    expect(
      onSubmit.mock.calls[0]?.[0],
      `期待: ${JSON.stringify({ kind: 'tiles', tiles: ['I', 'like', 'cats'] })}`,
    ).toEqual({
      kind: 'tiles',
      tiles: ['I', 'like', 'cats'],
    })
  })

  it('空では確認が押せない', () => {
    renderTilesView()
    const check = screen.getByRole('button', { name: '答え合わせ' }) as HTMLButtonElement

    expect(check.disabled, `期待: disabled`).toBe(true)
  })

  it('やり直しで全部戻る', async () => {
    renderTilesView()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'I' }))
    await user.click(screen.getByRole('button', { name: 'like' }))
    await user.click(screen.getByRole('button', { name: 'やり直す' }))

    expect(getAnswerRowTexts(), `期待: ${JSON.stringify([])}`).toEqual([])
    expect(getTrayTexts(), `期待: ${JSON.stringify(['cats', 'I', 'like'])}`).toEqual([
      'cats',
      'I',
      'like',
    ])
  })

  it('disabled で動かない', () => {
    renderTilesView({ disabled: true })

    const tile = screen.getByRole('button', { name: 'I' }) as HTMLButtonElement
    const check = screen.getByRole('button', { name: '答え合わせ' }) as HTMLButtonElement

    expect(tile.disabled, `期待: disabled`).toBe(true)
    expect(check.disabled, `期待: disabled`).toBe(true)
  })
})
