import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '../i18n'
import { RELATIVE_MONTH_OPTIONS } from '../app/goal'
import { ja } from '../i18n/ja'
import { DeadlineField } from './DeadlineField'

const TODAY = '2026-11-15'
const LABEL = '目標達成期限'

function expectEqual(actual: unknown, expected: unknown, input: unknown): void {
  expect(
    actual,
    `入力: ${JSON.stringify(input)}\n期待値: ${JSON.stringify(expected)}\n実際: ${JSON.stringify(actual)}`,
  ).toEqual(expected)
}

function renderDeadline(value = '2027-02-15') {
  const props = { id: 'goal', label: LABEL, value, today: TODAY, onChange: vi.fn() }
  const result = render(<DeadlineField {...props} />, {
    wrapper: ({ children }) => <I18nProvider initialLanguage="ja">{children}</I18nProvider>,
  })
  return { ...result, props }
}

describe('DeadlineField', () => {
  it('初期はラベルで到達できる日付入力で、value と明日を min に使う', () => {
    const { props } = renderDeadline()
    const input = screen.getByLabelText<HTMLInputElement>(LABEL)
    expectEqual(
      { id: input.id, type: input.type, value: input.value, min: input.min },
      { id: 'goal-date', type: 'date', value: props.value, min: '2026-11-16' },
      props,
    )
    expectEqual(screen.queryByRole('group', { name: LABEL }), null, props)
  })

  it.each([
    ['2027-03-01', [['2027-03-01']]],
    ['2026-11-10', []],
    ['2026-11-15', []],
    ['', []],
    ['2027-03', []],
  ])('日付入力 %s は完成した未来の日付だけ通知する', (value, expected) => {
    const { props } = renderDeadline()
    const input = screen.getByLabelText<HTMLInputElement>(LABEL)
    fireEvent.change(input, { target: { value } })
    expectEqual(props.onChange.mock.calls, expected, { today: TODAY, value })
    expectEqual(input.value, props.value, { value, controlledValue: props.value })
  })

  it('モードを切り替えると aria-pressed が変わり、7個の月数ボタンが出る', async () => {
    const user = userEvent.setup()
    const { props } = renderDeadline()
    const modeGroup = screen.getByRole('group', { name: '期限の指定方法' })
    const dateButton = within(modeGroup).getByRole('button', { name: '日付で指定' })
    const relativeButton = within(modeGroup).getByRole('button', { name: '○ヶ月後で指定' })
    const pressed = () => [
      dateButton.getAttribute('aria-pressed'),
      relativeButton.getAttribute('aria-pressed'),
    ]
    expectEqual(pressed(), ['true', 'false'], { mode: '初期' })

    await user.click(relativeButton)
    expectEqual(pressed(), ['false', 'true'], { mode: 'relative' })
    expectEqual(screen.queryByLabelText(LABEL, { selector: 'input' }), null, { mode: 'relative' })
    const buttons = within(screen.getByRole('group', { name: LABEL })).getAllByRole('button')
    expectEqual(buttons.length, 7, { mode: 'relative' })
    expectEqual(
      buttons.map((button) => button.textContent),
      RELATIVE_MONTH_OPTIONS.map((months) => `${months}ヶ月後`),
      { mode: 'relative', options: RELATIVE_MONTH_OPTIONS },
    )
    expectEqual(
      buttons.map((button) => button.getAttribute('aria-pressed')),
      ['false', 'false', 'true', 'false', 'false', 'false', 'false'],
      { value: props.value },
    )

    await user.click(dateButton)
    expectEqual(pressed(), ['true', 'false'], { mode: 'date' })
    expectEqual(screen.getByLabelText<HTMLInputElement>(LABEL).value, props.value, { mode: 'date' })
    expectEqual(props.onChange.mock.calls, [], { action: 'モード切り替えのみ' })
  })

  it.each([
    [1, '2026-12-15'],
    [2, '2027-01-15'],
    [3, '2027-02-15'],
    [4, '2027-03-15'],
    [6, '2027-05-15'],
    [9, '2027-08-15'],
    [12, '2027-11-15'],
  ])('%sヶ月後を押すと %s を1回通知する', async (months, expected) => {
    const user = userEvent.setup()
    const { props } = renderDeadline('2027-03-01')
    await user.click(screen.getByRole('button', { name: '○ヶ月後で指定' }))
    await user.click(screen.getByRole('button', { name: `${months}ヶ月後` }))
    expectEqual(props.onChange.mock.calls, [[expected]], { today: TODAY, months })
    expectEqual(
      within(screen.getByRole('group', { name: LABEL })).queryAllByRole('button', { pressed: true })
        .length,
      0,
      { action: `${months}ヶ月後を通知、親の value は未更新`, value: props.value },
    )
  })

  it('親が value を更新すると要約・選択状態・日付入力が追従する', async () => {
    const user = userEvent.setup()
    const { props, rerender } = renderDeadline()
    await user.click(screen.getByRole('button', { name: '○ヶ月後で指定' }))
    rerender(<DeadlineField {...props} value="2027-05-15" />)
    expectEqual(
      within(screen.getByRole('group', { name: LABEL }))
        .getAllByRole('button', { pressed: true })
        .map((button) => button.textContent),
      ['6ヶ月後'],
      { value: '2027-05-15' },
    )
    expectEqual(
      screen.queryByText(/期限: 2027-05-15/)?.textContent,
      '期限: 2027-05-15 あと181日(約6ヶ月)',
      { value: '2027-05-15' },
    )
    await user.click(screen.getByRole('button', { name: '日付で指定' }))
    expectEqual(screen.getByLabelText<HTMLInputElement>(LABEL).value, '2027-05-15', {
      value: '2027-05-15',
    })
  })

  it('両モードで期限と残り日数を表示し、status や aria-live を付けない', async () => {
    const user = userEvent.setup()
    const { container, props } = renderDeadline()
    for (const mode of ['日付で指定', '○ヶ月後で指定']) {
      await user.click(screen.getByRole('button', { name: mode }))
      const summary = container.querySelector('.deadline-summary')
      expectEqual(summary?.textContent, '期限: 2027-02-15 あと92日(約3ヶ月)', {
        value: props.value,
        mode,
      })
      expectEqual(screen.queryByRole('alert'), null, { value: props.value, mode })
      expectEqual(screen.queryByRole('status'), null, { value: props.value, mode })
      expectEqual(container.querySelector('[aria-live]'), null, { value: props.value, mode })
    }
  })

  it.each(['', '2026-11-10', '2026-11-15', '2027-02-30', 'abc'])(
    '無効な value=%s では両モードで警告を表示し、要約と status は出さない',
    async (value) => {
      const user = userEvent.setup()
      const { container } = renderDeadline(value)
      for (const mode of ['日付で指定', '○ヶ月後で指定']) {
        await user.click(screen.getByRole('button', { name: mode }))
        expectEqual(screen.getByRole('alert').textContent, ja['goal.deadline.invalid'], {
          value,
          mode,
        })
        expectEqual(container.querySelector('.deadline-summary'), null, { value, mode })
        expectEqual(screen.queryByRole('status'), null, { value, mode })
        expectEqual(container.querySelector('[aria-live]'), null, { value, mode })
      }
    },
  )

  it('同じ画面で複数使っても id とラベルが衝突しない', () => {
    render(
      <I18nProvider initialLanguage="ja">
        {['survey', 'settings'].map((id) => (
          <DeadlineField
            key={id}
            id={id}
            label={`${id}の期限`}
            value="2027-02-15"
            today={TODAY}
            onChange={vi.fn()}
          />
        ))}
      </I18nProvider>,
    )
    for (const id of ['survey', 'settings']) {
      expectEqual(screen.getByLabelText(`${id}の期限`).id, `${id}-date`, { id })
    }
  })
})
