import { recordTitle } from '@/lib/metadata/recordTitle'
import { notFound } from 'next/navigation'
import { getConversationById, getMessages, getTemplates } from '@/lib/whatsapp/queries'
import { getActiveAdvisors } from '@/lib/leads/queries'
import ChatWindow from '@/components/whatsapp/ChatWindow'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ConversationPage({ params }: Props) {
  const { id } = await params

  // The conversation list comes from the inbox layout; only the open chat is fetched here.
  const [conversation, messages, templates, advisors] = await Promise.all([
    getConversationById(id),
    getMessages(id),
    getTemplates(true),
    getActiveAdvisors(),
  ])

  if (!conversation) notFound()

  return <ChatWindow conversation={conversation} messages={messages} templates={templates} advisors={advisors} />
}

export const generateMetadata = ({ params }: { params: Promise<{ id: string }> }) => recordTitle('whatsapp_conversations', ['contact_name', 'contact_phone'], params, 'WhatsApp Chat')
