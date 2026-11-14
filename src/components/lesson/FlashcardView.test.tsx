import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n'
import type { FlashcardQuestion, PhraseSlotQuestion } from '../../engine/types'
import type { QuestionViewProps } from './types'
import { FlashcardView } from './FlashcardView'

const flashcard: FlashcardQuestion = {
  format: 'flashcard',
  itemId: 'w1',
  front: 'gato',
  back: '猫',
}

const phraseSlot: PhraseSlotQuestion = {
  format: 'phrase-slot',
  itemId: 'p1',
  target: 'El gato duerme.',
  meaning: '猫が寝ている。',
  filled: { animal: 'w1' },
}

function renderFlashcardView(
  question: FlashcardQuestion | PhraseSlotQuestion,
  overrides: Partial<QuestionViewProps<FlashcardQuestion | PhraseSlotQuestion>> = {},
) {
  const onSubmit = vi.fn()
  const onSpeak = vi.fn()
  const utils = render(
    <I18nProvider>
      <FlashcardView
        question={question}
        disabled={false}
        judgement={null}
        onSubmit={onSubmit}
        onSpeak={onSpeak}
        {...overrides}
      />
    </I18nProvider>,
  )
  return { onSubmit, onSpeak, ...utils }
}

describe('FlashcardView', () => {
  it('裏返す前は採点ボタンが無い', () => {
    renderFlashcardView(flashcard)
    expect(screen.queryByText('gato'), '入力: front=gato').not.toBeNull()
    expect(screen.queryByRole('button', { name: '1. わからない' }), '入力: 裏返す前').toBeNull()
  })

  it('めくると裏と4つの採点ボタンが出る', async () => {
    const user = userEvent.setup()
    renderFlashcardView(flashcard)
    await user.click(screen.getByRole('button', { name: 'めくる' }))
    expect(screen.queryByText('猫'), '入力: back=猫').not.toBeNull()
    expect(
      screen.queryByRole('button', { name: '1. わからない' }),
      '入力: 裏返した後',
    ).not.toBeNull()
    expect(screen.queryByRole('button', { name: '2. あいまい' }), '入力: 裏返した後').not.toBeNull()
    expect(screen.queryByRole('button', { name: '3. わかった' }), '入力: 裏返した後').not.toBeNull()
    expect(screen.queryByRole('button', { name: '4. 簡単' }), '入力: 裏返した後').not.toBeNull()
  })

  it('押すと onSubmit が { kind: selfGrade, grade } で1回だけ呼ばれる', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFlashcardView(flashcard)
    await user.click(screen.getByRole('button', { name: 'めくる' }))
    await user.click(screen.getByRole('button', { name: '3. わかった' }))
    expect(onSubmit, '入力: 採点ボタンクリック').toHaveBeenCalledTimes(1)
    expect(onSubmit, '入力: 採点ボタンクリック').toHaveBeenCalledWith({
      kind: 'selfGrade',
      grade: 'good',
    })
  })

  it('数字キーで選べる', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFlashcardView(flashcard)
    await user.click(screen.getByRole('button', { name: 'めくる' }))
    await user.keyboard('2')
    expect(onSubmit, '入力: 数字キー 2').toHaveBeenCalledTimes(1)
    expect(onSubmit, '入力: 数字キー 2').toHaveBeenCalledWith({ kind: 'selfGrade', grade: 'hard' })
  })

  it('PhraseSlotQuestion でも動く', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFlashcardView(phraseSlot)
    expect(screen.queryByText('El gato duerme.'), '入力: target').not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'めくる' }))
    expect(screen.queryByText('猫が寝ている。'), '入力: meaning').not.toBeNull()
    await user.click(screen.getByRole('button', { name: '4. 簡単' }))
    expect(onSubmit, '入力: phrase-slot 採点').toHaveBeenCalledWith({
      kind: 'selfGrade',
      grade: 'easy',
    })
  })

  it('disabled で押せない', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderFlashcardView(flashcard, { disabled: true })
    await user.click(screen.getByRole('button', { name: 'めくる' }))
    const button = screen.getByRole('button', { name: '3. わかった' }) as HTMLButtonElement
    expect(button.disabled, '入力: disabled=true').toBe(true)
    await user.click(button)
    expect(onSubmit, '入力: disabled=true').not.toHaveBeenCalled()
  })

  it('judgement があるとき選んだ評価のボタンを強調する', async () => {
    const user = userEvent.setup()
    renderFlashcardView(flashcard, {
      judgement: { correct: true, close: false, correctText: '猫', selfGrade: 'good' },
    })
    await user.click(screen.getByRole('button', { name: 'めくる' }))
    const button = screen.getByRole('button', { name: '3. わかった' })
    expect(button.className, '入力: selfGrade=good').toContain('lc-flashcard-grade-active')
  })
})
