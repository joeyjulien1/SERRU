import { Icon } from '../Icon';

/** How customers pay: Whish Money or cash on delivery (orders are confirmed on WhatsApp). */
export function PaymentMethods({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <ul className={`pay-methods pay-methods--${tone}`} aria-label="Accepted payment methods">
      <li>
        <img src="/brand/whish.png" alt="" width={39} height={14} />
        Whish Money
      </li>
      <li>
        <Icon name="cash" size={20} />
        Cash on delivery
      </li>
    </ul>
  );
}
