import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../../i18n'
import type { Sentence, Word } from '../../schema/content'
import { IntroCard } from './IntroCard'

const word: Word = {
  id: 'w1',
  lemma: 'gato',
  pos: '名詞',
  reading: 'ガト',
  meaning: ['猫', '子猫'],
  tags: ['animal'],
  rel: [],
  uncertain: false,
  note: '',
}

const sentences: ReadonlyArray<Sentence> = [
  { id: 's1', target: 'El gato duerme.', meaning: '猫が寝ている。', wordIds: ['w1'] },
]

const related: ReadonlyArray<Word> = [
  {
    id: 'w2',
    lemma: 'perro',
    pos: '名詞',
    reading: '',
    meaning: ['犬'],
    tags: [],
    rel: [],
    uncertain: false,
    note: '',
  },
]

function renderIntroCard(props: Partial<Parameters<typeof IntroCard>[0]> = {}) {
  const onContinue = vi.fn()
  const onSpeak = vi.fn()
  const utils = render(
    <I18nProvider>
      <IntroCard
        word={word}
        sentences={sentences}
        related={related}
        onContinue={onContinue}
        onSpeak={onSpeak}
        {...props}
      />
    </I18nProvider>,
  )
  return { onContinue, onSpeak, ...utils }
}

describe('IntroCard', () => {
  it('見出し語・意味・例文・関係のある語が出る', () => {
    renderIntroCard()
    expect(screen.queryByText('gato'), '入力: word.lemma=gato').not.toBeNull()
    expect(screen.queryByText('ガト'), '入力: word.reading=ガト').not.toBeNull()
    expect(screen.queryByText('名詞'), '入力: word.pos=名詞').not.toBeNull()
    expect(screen.queryByText('猫、子猫'), '入力: word.meaning=猫,子猫').not.toBeNull()
    expect(screen.queryByText('El gato duerme.'), '入力: sentences[0].target').not.toBeNull()
    expect(screen.queryByText('猫が寝ている。'), '入力: sentences[0].meaning').not.toBeNull()
    expect(screen.queryByText('perro — 犬'), '入力: related[0]').not.toBeNull()
  })

  it('読みが空のとき読みを出さない', () => {
    renderIntroCard({ word: { ...word, reading: '' } })
    expect(screen.queryByText('ガト'), '入力: word.reading=""').toBeNull()
  })

  it('uncertain のとき「要確認」バッジが出る', () => {
    renderIntroCard({ word: { ...word, uncertain: true } })
    expect(screen.queryByText('要確認'), '入力: word.uncertain=true').not.toBeNull()
  })

  it('onContinue がボタンで呼ばれる', async () => {
    const user = userEvent.setup()
    const { onContinue } = renderIntroCard()
    await user.click(screen.getByRole('button', { name: 'わかった' }))
    expect(onContinue, '入力: ボタンクリック').toHaveBeenCalledTimes(1)
  })

  it('onContinue が Enter で呼ばれる', async () => {
    const user = userEvent.setup()
    const { onContinue } = renderIntroCard()
    await user.keyboard('{Enter}')
    expect(onContinue, '入力: Enter キー').toHaveBeenCalledTimes(1)
  })

  it('onSpeak を渡したときだけ音声ボタンがあり押すと呼ばれる', async () => {
    const user = userEvent.setup()
    const { onSpeak } = renderIntroCard()
    const button = screen.getByRole('button', { name: '音声を聞く' })
    expect(button, '入力: onSpeak あり').not.toBeNull()
    await user.click(button)
    expect(onSpeak, '入力: 音声ボタンクリック').toHaveBeenCalledWith('gato')
  })

  it('onSpeak を渡さないと音声ボタンが無い', () => {
    renderIntroCard({ onSpeak: undefined })
    expect(screen.queryByRole('button', { name: '音声を聞く' }), '入力: onSpeak なし').toBeNull()
  })
})
