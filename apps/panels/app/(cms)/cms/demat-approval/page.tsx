import { redirect } from 'next/navigation';

/**
 * CMS Demat Approval (Legacy Route)
 * Demat approval has moved to the Operations panel.
 * Redirects automatically to /operation/demat-approval.
 */
export default function CMSDematApprovalRedirect() {
  redirect('/operation/demat-approval');
}
