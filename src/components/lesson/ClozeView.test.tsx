import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ClozeQuestion, Response } from '../../engine/types'
import { I18nProvider } from '../../i18n'
import type { QuestionViewProps } from './types'
import { ClozeView } from './ClozeView'

function makeChoiceQuestion(overrides: Partial<ClozeQuestion> = {}): ClozeQuestion {
  return {
    format: 'cloze',
    itemId: 'word-1',
    sentenceId: 'sentence-1',
    before: '私は ',
    after: ' を飼っています。',
    answer: 'ねこ',
    mode: 'choice',
    options: [
      { id: 'opt-1', text: 'いぬ' },
      { id: 'opt-2', text: 'ねこ' },
      { id: 'opt-3', text: 'あめ' },
      { id: 'opt-4', text: 'き' },
    ],
    correctId: 'opt-2',
    accepted: [],
    ...overrides,
  }
}

function makeTypingQuestion(overrides: Partial<ClozeQuestion> = {}): ClozeQuestion {
  return {
    format: 'cloze',
    itemId: 'word-1',
    sentenceId: 'sentence-2',
    before: '私は ',
    after: ' を飼っています。',
    answer: 'ねこ',
    mode: 'typing',
    accepted: ['cat'],
    ...overrides,
  }
}

function renderClozeView(props: Partial<QuestionViewProps<ClozeQuestion>> = {}) {
  const question = makeTypingQuestion(props.question ?? {})
  const onSubmitMock = vi.fn()

  const onSubmit = (response: Response) => {
    props.onSubmit?.(response)
    onSubmitMock(response)
  }

  render(
    <I18nProvider>
      <ClozeView
        question={question}
        disabled={props.disabled ?? false}
        judgement={props.judgement ?? null}
        onSubmit={onSubmit}
        onSpeak={vi.fn()}
      />
    </I18nProvider>,
  )

  return { question, onSubmit: onSubmitMock }
}

describe('ClozeView', () => {
  it('choice mode submits clicked option and number key selection', async () => {
    const user = userEvent.setup()
    const question = makeChoiceQuestion()
    const onSubmit = vi.fn()

    render(
      <I18nProvider>
        <ClozeView
          question={question}
          disabled={false}
          judgement={null}
          onSubmit={onSubmit}
          onSpeak={vi.fn()}
        />
      </I18nProvider>,
    )

    await user.click(screen.getByText('ねこ'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(
      onSubmit.mock.calls[0]?.[0],
      `入力: クリックした選択肢「ねこ」 / 期待値: { kind: 'choice', optionId: 'opt-2' } / 実際: ${JSON.stringify(
        onSubmit.mock.calls[0]?.[0],
      )}`,
    ).toEqual({ kind: 'choice', optionId: 'opt-2' })

    const secondOnSubmit = vi.fn()
    render(
      <I18nProvider>
        <ClozeView
          question={question}
          disabled={false}
          judgement={null}
          onSubmit={secondOnSubmit}
          onSpeak={vi.fn()}
        />
      </I18nProvider>,
    )

    await user.keyboard('3')
    expect(secondOnSubmit).toHaveBeenCalledTimes(1)
    expect(
      secondOnSubmit.mock.calls[0]?.[0],
      `入力: 数字キー「3」 / 期待値: { kind: 'choice', optionId: 'opt-3' } / 実際: ${JSON.stringify(
        secondOnSubmit.mock.calls[0]?.[0],
      )}`,
    ).toEqual({ kind: 'choice', optionId: 'opt-3' })
  })

  it('typing mode submits text with Enter and does not submit empty input', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    renderClozeView({ question: makeTypingQuestion(), onSubmit })

    const input = screen.getByPlaceholderText('答えを入力')
    await user.type(input, '   ')
    await user.keyboard('{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()

    await user.clear(input)
    await user.type(input, 'ねこ')
    await user.keyboard('{Enter}')

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(
      onSubmit.mock.calls[0]?.[0],
      `入力: 入力テキスト「ねこ」 / 期待値: { kind: 'text', text: 'ねこ' } / 実際: ${JSON.stringify(
        onSubmit.mock.calls[0]?.[0],
      )}`,
    ).toEqual({ kind: 'text', text: 'ねこ' })
  })

  it('shows before and after sentence parts', () => {
    const question = makeTypingQuestion()
    renderClozeView({ question })

    expect(
      screen.getByText(/私は/),
      `入力: before="私は " / 期待値: 表示される / 実際: ${screen.queryByText(/私は/)}`,
    ).toBeTruthy()
    expect(
      screen.getByText(/を飼っています。/),
      `入力: after=" を飼っています。" / 期待値: 表示される / 実際: ${screen.queryByText(/を飼っています。/)}`,
    ).toBeTruthy()
  })

  it('shows close hint when judgement.close is true', () => {
    const question = makeTypingQuestion()
    render(
      <I18nProvider>
        <ClozeView
          question={question}
          disabled={true}
          judgement={{ correct: false, close: true, hint: 'cが抜けています', correctText: 'ねこ' }}
          onSubmit={vi.fn()}
          onSpeak={vi.fn()}
        />
      </I18nProvider>,
    )

    expect(
      screen.getByText('おしい!'),
      `入力: judgement.close=true / 期待値: おしい! を表示 / 実際: ${screen.queryByText('おしい!')}`,
    ).toBeTruthy()
    expect(
      screen.getByText(/cが抜けています/),
      `入力: judgement.hint="cが抜けています" / 期待値: ヒントを表示 / 実際: ${screen.queryByText(/cが抜けています/)}`,
    ).toBeTruthy()
  })

  it('uses lesson.fill.typing for typing mode', () => {
    const question = makeTypingQuestion()
    render(
      <I18nProvider>
        <ClozeView
          question={question}
          disabled={true}
          judgement={null}
          onSubmit={vi.fn()}
          onSpeak={vi.fn()}
        />
      </I18nProvider>,
    )

    expect(
      screen.getByText('空欄に入る語を入力する'),
      `入力: typing mode / 期待値: 空欄に入る語を入力する / 実際: ${screen.queryByText('空欄に入る語を入力する')?.textContent}`,
    ).toBeTruthy()
  })

  it('uses lesson.fill for choice mode', () => {
    const question = makeChoiceQuestion()
    render(
      <I18nProvider>
        <ClozeView
          question={question}
          disabled={true}
          judgement={null}
          onSubmit={vi.fn()}
          onSpeak={vi.fn()}
        />
      </I18nProvider>,
    )

    expect(
      screen.getByText('空欄に入る語を選ぶ'),
      `入力: choice mode / 期待値: 空欄に入る語を選ぶ / 実際: ${screen.queryByText('空欄に入る語を選ぶ')?.textContent}`,
    ).toBeTruthy()
  })

  it('does not have role="status" in feedback area', () => {
    const question = makeTypingQuestion()
    render(
      <I18nProvider>
        <ClozeView
          question={question}
          disabled={true}
          judgement={{ correct: false, close: false, correctText: 'ねこ' }}
          onSubmit={vi.fn()}
          onSpeak={vi.fn()}
        />
      </I18nProvider>,
    )

    expect(
      screen.getByText('不正解'),
      `入力: judgementあり / 期待値: 文言「不正解」を表示 / 実際: ${screen.queryByText('不正解')?.textContent}`,
    ).toBeTruthy()

    const input = screen.getByPlaceholderText('答えを入力') as HTMLInputElement
    expect(
      input.className,
      `入力: 不正解 judgement / 期待値: lq-input--danger と kp-anim-shake を含む / 実際: ${input.className}`,
    ).toContain('lq-input--danger')
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
