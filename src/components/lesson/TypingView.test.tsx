import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TypingView } from './TypingView'
import { I18nProvider } from '../../i18n'
import type { Judgement, TypingQuestion } from '../../engine/types'
import type { AnswerMeta } from './types'

const question: TypingQuestion = {
  format: 'typing',
  itemId: 'word-1',
  prompt: 'マンガ',
  answer: 'manga',
  accepted: [],
}

function renderTypingView(props: Partial<Parameters<typeof TypingView>[0]> = {}) {
  const onSubmit = vi.fn()
  const view = (
    <I18nProvider>
      <TypingView
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TypingView', () => {
  it('入力して Enter で onSubmit を text 回答で呼ぶ', async () => {
    const { onSubmit } = renderTypingView()
    const input = screen.getByRole('textbox') as HTMLInputElement
    const user = userEvent.setup()

    await user.type(input, 'manga')
    await user.keyboard('{Enter}')

    expect(onSubmit, `入力: ${JSON.stringify('manga')}`).toHaveBeenCalledTimes(1)
    expect(
      onSubmit.mock.calls[0]?.[0],
      `期待: ${JSON.stringify({ kind: 'text', text: 'manga' })}`,
    ).toEqual({
      kind: 'text',
      text: 'manga',
    })
  })

  it('空のときは onSubmit を呼ばない', async () => {
    const { onSubmit } = renderTypingView()
    const input = screen.getByRole('textbox') as HTMLInputElement
    const user = userEvent.setup()

    await user.type(input, '   ')
    await user.keyboard('{Enter}')

    expect(onSubmit, `入力: ${JSON.stringify('   ')}`).not.toHaveBeenCalled()
  })

  it('ヒントで先頭1文字と文字数を表示し、以降の送信に usedHint: true を付ける', async () => {
    const { onSubmit } = renderTypingView()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'ヒント' }))
    expect(screen.queryByText('m____'), `期待: m____`).not.toBeNull()

    await user.type(screen.getByRole('textbox'), 'manga')
    await user.keyboard('{Enter}')

    const meta = onSubmit.mock.calls[0]?.[1] as AnswerMeta | undefined
    expect(meta, `期待: usedHint true`).toEqual(expect.objectContaining({ usedHint: true }))
  })

  it('20秒を超えると slow: true を付ける', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000)
    const { onSubmit } = renderTypingView()
    const user = userEvent.setup()

    await user.type(screen.getByRole('textbox'), 'manga')
    now.mockReturnValue(22_000)
    await user.keyboard('{Enter}')

    const meta = onSubmit.mock.calls[0]?.[1] as AnswerMeta | undefined
    expect(meta, `期待: slow true`).toEqual(expect.objectContaining({ slow: true }))
  })

  it('judgement.close でヒントを表示する', () => {
    const judgement: Judgement = {
      correct: false,
      close: true,
      hint: 'm____',
      correctText: 'manga',
    }
    renderTypingView({ judgement })

    expect(screen.queryByText('おしい!'), `期待: おしい!`).not.toBeNull()
    expect(screen.queryByText('m____'), `期待: m____`).not.toBeNull()
  })

  it('disabled で入力できない', () => {
    renderTypingView({ disabled: true })
    const input = screen.getByRole('textbox') as HTMLInputElement

    expect(input.disabled, `期待: disabled`).toBe(true)
    expect(input.value, `期待: 空`).toBe('')
  })
})
