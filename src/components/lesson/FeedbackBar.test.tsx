import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n'
import type { Judgement } from '../../engine/types'
import type { GrammarNote, Sentence } from '../../schema/content'
import { FeedbackBar } from './FeedbackBar'

const grammarNotes: ReadonlyArray<GrammarNote> = [
  { id: 'g1', appliesTo: ['w1'], title: '名詞の性', hint: 'gato は男性名詞です' },
]

const examples: ReadonlyArray<Sentence> = [
  { id: 's1', target: 'El gato duerme.', meaning: '猫が寝ている。', wordIds: ['w1'] },
]

function renderFeedbackBar(judgement: Judgement) {
  const onNext = vi.fn()
  const utils = render(
    <I18nProvider>
      <FeedbackBar
        judgement={judgement}
        grammarNotes={grammarNotes}
        examples={examples}
        onNext={onNext}
      />
    </I18nProvider>,
  )
  return { onNext, ...utils }
}

describe('FeedbackBar', () => {
  it('正解のとき正解テキストと role=status がある', () => {
    renderFeedbackBar({ correct: true, close: false, correctText: '猫' })
    expect(screen.queryByText('正解!'), '入力: correct=true').not.toBeNull()
    expect(screen.queryByRole('status'), '入力: correct=true').not.toBeNull()
  })

  it('おしいのときおしいヒントが出る', () => {
    renderFeedbackBar({ correct: false, close: true, hint: '1文字違い', correctText: 'gato' })
    expect(screen.queryByText('おしい!'), '入力: close=true').not.toBeNull()
    expect(screen.queryByText(/1文字違い/), '入力: hint=1文字違い').not.toBeNull()
  })

  it('不正解のとき不正解と正解テキストが出る', () => {
    renderFeedbackBar({ correct: false, close: false, correctText: 'gato' })
    expect(screen.queryByText('不正解'), '入力: correct=false, close=false').not.toBeNull()
    expect(screen.queryByText('正解: gato'), '入力: correctText=gato').not.toBeNull()
  })

  it('文法メモと例文が出る', () => {
    renderFeedbackBar({ correct: true, close: false, correctText: '猫' })
    expect(screen.queryByText('名詞の性'), '入力: grammarNotes[0].title').not.toBeNull()
    expect(screen.queryByText('gato は男性名詞です'), '入力: grammarNotes[0].hint').not.toBeNull()
    expect(screen.queryByText('El gato duerme.'), '入力: examples[0].target').not.toBeNull()
    expect(screen.queryByText('猫が寝ている。'), '入力: examples[0].meaning').not.toBeNull()
  })

  it('onNext がボタンで呼ばれる', async () => {
    const user = userEvent.setup()
    const { onNext } = renderFeedbackBar({ correct: true, close: false, correctText: '猫' })
    await user.click(screen.getByRole('button', { name: '次へ' }))
    expect(onNext, '入力: ボタンクリック').toHaveBeenCalledTimes(1)
  })

  it('onNext が Enter で呼ばれる', async () => {
    const user = userEvent.setup()
    const { onNext } = renderFeedbackBar({ correct: true, close: false, correctText: '猫' })
    await user.keyboard('{Enter}')
    expect(onNext, '入力: Enter キー').toHaveBeenCalledTimes(1)
  })
})
