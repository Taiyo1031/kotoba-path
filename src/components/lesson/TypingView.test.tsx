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

  it('li-hint-text has aria-live="polite"', async () => {
    renderTypingView()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'ヒント' }))

    const hintElement = screen.getByText('m____').closest('.li-hint-text')
    expect(
      hintElement?.className,
      `入力: ヒントボタンクリック後 / 期待値: li-hint-text クラスを持つ要素 / 実際: ${hintElement?.className}`,
    ).toContain('li-hint-text')
    expect(
      hintElement?.getAttribute('aria-live'),
      `入力: ヒントボタンクリック後 / 期待値: aria-live="polite" / 実際: ${hintElement?.getAttribute('aria-live')}`,
    ).toBe('polite')
  })

  it('li-close-hint does not have aria-live', () => {
    const judgement: Judgement = {
      correct: false,
      close: true,
      hint: 'm____',
      correctText: 'manga',
    }
    renderTypingView({ judgement })

    const closeHintElement = screen.getByText('おしい!').closest('.li-close-hint')
    expect(
      closeHintElement?.className,
      `入力: judgement.close=true / 期待値: li-close-hint クラスを持つ要素 / 実際: ${closeHintElement?.className}`,
    ).toContain('li-close-hint')
    expect(
      closeHintElement?.getAttribute('aria-live'),
      `入力: judgement.close=true / 期待値: aria-live 属性なし / 実際: ${closeHintElement?.getAttribute('aria-live')}`,
    ).toBeNull()
  })

  it('does not have role="status" in feedback area', () => {
    const judgement: Judgement = { correct: false, close: false, correctText: 'manga' }
    renderTypingView({ judgement })

    const input = screen.getByRole('textbox') as HTMLInputElement
    expect(
      input.className,
      `入力: 不正解 judgement / 期待値: li-input-danger と kp-anim-shake を含む / 実際: ${input.className}`,
    ).toContain('li-input-danger')
    expect(
      input.className,
      `入力: 不正解 judgement / 期待値: kp-anim-shake を含む / 実際: ${input.className}`,
    ).toContain('kp-anim-shake')

    const statusRegions = screen.queryAllByRole('status')
    expect(
      statusRegions.length,
      `入力: judgementあり / 期待値: role="status" の要素 0個 / 実際: ${statusRegions.length}個`,
    ).toBe(0)
  })
})
