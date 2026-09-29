'use strict';
// Quote details are included only in the customer's prepared email or text.
// Browser validation assists collection; JDG must independently verify the order.
function toggleVerificationFields(groupId, enabled) {
  const group = $(groupId);
  group.hidden = !enabled;
  group.querySelectorAll('input').forEach(input => {
    input.disabled = !enabled;
    input.required = enabled;
  });
}
function syncVerificationFields() {
  toggleVerificationFields('payer-fields', $('payer-role').value !== 'self');
  toggleVerificationFields('recipient-fields', !$('receive-load').checked);
}
$('payer-role').addEventListener('change', syncVerificationFields);
$('receive-load').addEventListener('change', syncVerificationFields);
window.addEventListener('pageshow', syncVerificationFields);
syncVerificationFields();

function quoteContactLines() {
  const value = id => $(id).value.trim();
  const selfPayer = value('payer-role') === 'self';
  const selfRecipient = $('receive-load').checked;
  return [
    'Buyer name: ' + value('name'),
    'Buyer phone: ' + value('phone'),
    'Buyer email: ' + value('email'),
    'Company / project: ' + value('company'),
    'Paying party: ' + (selfPayer ? 'Buyer' : $('payer-role').selectedOptions[0].textContent),
    'Payer name: ' + value(selfPayer ? 'name' : 'payer-name'),
    'Payer phone: ' + value(selfPayer ? 'phone' : 'payer-phone'),
    'Delivery address: ' + value('address'),
    'Delivery city: ' + value('city') + ', FL',
    'Delivery county: ' + value('county'),
    'Delivery ZIP: ' + value('zip'),
    'On-site recipient: ' + value(selfRecipient ? 'name' : 'recipient-name'),
    'Recipient phone: ' + value(selfRecipient ? 'phone' : 'recipient-phone'),
    'Requested date: ' + (value('date') || 'Please confirm availability'),
    'Site access / project notes: ' + value('notes'),
    'Buyer acknowledgment: ' + ($('order-acknowledgment').checked ? 'Accepted order and delivery details, version 2026-09-29.' : 'Not accepted.'),
    'JDG confirmation required before purchasing material or dispatch. This is a quote request, not an approved order.'
  ];
}
