import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { McqQuestion, Response } from '../../engine/types'
import { I18nProvider } from '../../i18n'
import type { QuestionViewProps } from './types'
import { McqView } from './McqView'

function makeQuestion(overrides: Partial<McqQuestion> = {}): McqQuestion {
  return {
    format: 'mcq',
    itemId: 'word-1',
    direction: 'foreignToNative',
    prompt: 'gato',
    options: [
      { id: 'opt-1', text: 'ねこ' },
      { id: 'opt-2', text: 'いぬ' },
      { id: 'opt-3', text: 'あめ' },
      { id: 'opt-4', text: 'き' },
    ],
    correctId: 'opt-1',
    ...overrides,
  }
}

function renderMcqView(props: Partial<QuestionViewProps<McqQuestion>> = {}) {
  const question = makeQuestion(props.question ?? {})
  const onSubmitMock = vi.fn()
  const onSpeakMock = vi.fn()

  const onSubmit = (response: Response) => {
    props.onSubmit?.(response)
    onSubmitMock(response)
  }

  const onSpeak = (text: string) => {
    props.onSpeak?.(text)
    onSpeakMock(text)
  }

  render(
    <I18nProvider>
      <McqView
        question={question}
        disabled={props.disabled ?? false}
        judgement={props.judgement ?? null}
        onSubmit={onSubmit}
        onSpeak={onSpeak}
      />
    </I18nProvider>,
  )

  return { question, onSubmit: onSubmitMock, onSpeak: onSpeakMock }
}

describe('McqView', () => {
  it('renders four numbered options and submits the clicked option once', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderMcqView()

    const allButtons = screen.getAllByRole('button')
    const optionButtons = allButtons.filter((btn) => btn.querySelector('.lq-option-number'))
    expect(
      optionButtons.length,
      `入力: 選択肢4個 / 期待値: 4 / 実際: ${optionButtons.length}`,
    ).toBe(4)

    await user.click(screen.getByText('いぬ'))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(
      onSubmit.mock.calls[0]?.[0],
      `入力: クリックした選択肢「いぬ」 / 期待値: { kind: 'choice', optionId: 'opt-2' } / 実際: ${JSON.stringify(
        onSubmit.mock.calls[0]?.[0],
      )}`,
    ).toEqual({ kind: 'choice', optionId: 'opt-2' })

    await user.click(screen.getByText('あめ'))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('submits the second option with number key 2', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderMcqView()

    await user.keyboard('2')

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(
      onSubmit.mock.calls[0]?.[0],
      `入力: 数字キー「2」 / 期待値: { kind: 'choice', optionId: 'opt-2' } / 実際: ${JSON.stringify(
        onSubmit.mock.calls[0]?.[0],
      )}`,
    ).toEqual({ kind: 'choice', optionId: 'opt-2' })
  })

  it('does not submit when disabled', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderMcqView({ disabled: true })

    await user.click(screen.getByText('いぬ'))
    await user.keyboard('3')

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('marks the correct option success and selected wrong option danger with shake', async () => {
    const user = userEvent.setup()
    const question = makeQuestion({ correctId: 'opt-1' })
    const onSubmit = vi.fn()

    const view = render(
      <I18nProvider>
        <McqView
          question={question}
          disabled={false}
          judgement={null}
          onSubmit={onSubmit}
          onSpeak={vi.fn()}
        />
      </I18nProvider>,
    )

    await user.click(screen.getByText('いぬ'))

    view.rerender(
      <I18nProvider>
        <McqView
          question={question}
          disabled={true}
          judgement={{ correct: false, close: false, correctText: 'ねこ' }}
          onSubmit={onSubmit}
          onSpeak={vi.fn()}
        />
      </I18nProvider>,
    )

    const wrongOption = screen.getByText('いぬ').closest('button')
    const correctOption = screen.getByText('ねこ').closest('button')

    expect(
      wrongOption?.className,
      `入力: 不正解選択「いぬ」 / 期待値: lq-option--danger と kp-anim-shake を含む / 実際: ${wrongOption?.className}`,
    ).toContain('lq-option--danger')
    expect(
      wrongOption?.className,
      `入力: 不正解選択「いぬ」 / 期待値: kp-anim-shake を含む / 実際: ${wrongOption?.className}`,
    ).toContain('kp-anim-shake')

    expect(
      correctOption?.className,
      `入力: 正解選択肢「ねこ」 / 期待値: lq-option--success を含む / 実際: ${correctOption?.className}`,
    ).toContain('lq-option--success')
  })

  it('hides prompt and shows audio button for audioToMeaning when onSpeak is provided', () => {
    const question = makeQuestion({ direction: 'audioToMeaning' })
    const onSpeak = vi.fn()

    render(
      <I18nProvider>
        <McqView
          question={question}
          disabled={false}
          judgement={null}
          onSubmit={vi.fn()}
          onSpeak={onSpeak}
        />
      </I18nProvider>,
    )

    expect(
      screen.queryByText('gato'),
      `入力: direction=audioToMeaning / 期待値: null / 実際: ${screen.queryByText('gato')?.textContent}`,
    ).toBeNull()

    const audioButton = screen.getByRole('button', { name: '音声を聞く' })
    expect(
      audioButton,
      `入力: onSpeakあり / 期待値: 音声ボタン存在 / 実際: ${audioButton.textContent}`,
    ).toBeTruthy()
  })

  it('does not have role="status" in feedback area', () => {
    const question = makeQuestion()
    render(
      <I18nProvider>
        <McqView
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

    const statusRegions = screen.queryAllByRole('status')
    expect(
      statusRegions.length,
      `入力: judgementあり / 期待値: role="status" の要素 0個 / 実際: ${statusRegions.length}個`,
    ).toBe(0)
  })
  it.each([
    { promptReading: 'スラマッ', showReading: undefined, expected: 'スラマッ' },
    { promptReading: 'スラマッ', showReading: false, expected: null },
    { promptReading: undefined, showReading: undefined, expected: null },
  ])('reading display: %j', ({ promptReading, showReading, expected }) => {
    const question = makeQuestion(promptReading === undefined ? {} : { promptReading })
    const { container } = render(
      <I18nProvider>
        <McqView
          question={question}
          disabled={false}
          judgement={null}
          onSubmit={vi.fn()}
          {...(showReading === undefined ? {} : { showReading })}
        />
      </I18nProvider>,
    )
    const actual = container.querySelector('.lq-reading')?.textContent ?? null
    expect(actual, 'Input: ' + JSON.stringify({ promptReading, showReading })).toBe(expected)
    if (expected !== null) {
      expect(
        container.querySelector('.lq-prompt')?.nextElementSibling?.className,
        'Input: reading enabled',
      ).toBe('lq-reading')
    }
  })
})
