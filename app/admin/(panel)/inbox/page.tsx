import type { Metadata } from 'next';
import Link from 'next/link';
import { deleteMessageAction, deleteSubscriberAction, setMessageReadAction } from '@/app/admin/actions';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { Empty, PageHead } from '@/components/admin/parts';
import { Icon } from '@/components/Icon';
import { listMessages, listSubscribers } from '@/lib/admin-data';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = { title: 'Inbox' };

export default async function InboxPage(props: PageProps<'/admin/inbox'>) {
  const { tab } = (await props.searchParams) as { tab?: string };
  const showSubs = tab === 'subscribers';
  const messages = listMessages();
  const subscribers = listSubscribers();
  const unread = messages.filter((m) => !m.isRead).length;

  return (
    <>
      <PageHead
        title="Inbox"
        description="Contact-form enquiries, commission requests and newsletter sign-ups."
        actions={
          showSubs && subscribers.length > 0 ? (
            <a href="/api/admin/export?type=subscribers" className="btn btn--outline">
              <Icon name="download" size={16} /> Export CSV
            </a>
          ) : undefined
        }
      />
      <div className="adm-card">
        <nav className="adm-tabs" aria-label="Inbox sections">
          <Link href="/inbox" aria-current={!showSubs ? 'page' : undefined}>
            Messages {unread > 0 ? `(${unread} new)` : ''}
          </Link>
          <Link href="/inbox?tab=subscribers" aria-current={showSubs ? 'page' : undefined}>
            Subscribers ({subscribers.length})
          </Link>
        </nav>

        {!showSubs &&
          (messages.length === 0 ? (
            <Empty icon="inbox" title="No messages yet">
              Messages sent from the contact page arrive here.
            </Empty>
          ) : (
            messages.map((m) => (
              <article key={m.id} className="adm-message" data-unread={!m.isRead}>
                <div className="adm-message__head">
                  <div>
                    <strong style={{ fontWeight: 500 }}>{m.subject || 'General enquiry'}</strong>
                    <div className="small muted">
                      {m.name} ·{' '}
                      <a className="link" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Your enquiry'))}`}>
                        {m.email}
                      </a>
                      {m.phone && (
                        <>
                          {' · '}
                          <a className="link" href={`tel:${m.phone.replace(/\s/g, '')}`}>
                            {m.phone}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <span className="tiny muted">{formatDate(m.createdAt, true)}</span>
                </div>
                <p className="adm-message__body">{m.body}</p>
                <div className="adm-message__actions">
                  <a className="btn btn--sm" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + (m.subject || 'Your enquiry'))}`}>
                    <Icon name="mail" size={14} /> Reply
                  </a>
                  <ConfirmButton action={setMessageReadAction.bind(null, m.id, !m.isRead)}>
                    <Icon name={m.isRead ? 'dot' : 'check'} size={14} /> {m.isRead ? 'Mark unread' : 'Mark read'}
                  </ConfirmButton>
                  <ConfirmButton action={deleteMessageAction.bind(null, m.id)} confirmText="Delete this message?" title="Delete message">
                    <Icon name="trash" size={14} />
                  </ConfirmButton>
                </div>
              </article>
            ))
          ))}

        {showSubs &&
          (subscribers.length === 0 ? (
            <Empty icon="mail" title="No subscribers yet">
              Newsletter sign-ups from the homepage and checkout appear here.
            </Empty>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Subscribed</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((s) => (
                    <tr key={s.id}>
                      <td>{s.email}</td>
                      <td className="small nowrap">{formatDate(s.createdAt)}</td>
                      <td className="num">
                        <ConfirmButton action={deleteSubscriberAction.bind(null, s.id)} confirmText={`Remove ${s.email} from the list?`} title="Remove">
                          <Icon name="trash" size={14} />
                        </ConfirmButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </>
  );
}
