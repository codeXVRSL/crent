'use client';
import { useState } from 'react';
import { ActionForm, SubmitButton } from './form';
import { Field, Input, Select } from './ui';
import { addPayoutMethod } from '@/app/actions/wallet';

// Common Philippine banks with their payout channel codes. Check this list against the payment provider's
// current channel list before switching to real payouts; "Other" lets a researcher type any code.
const BANKS: [string, string][] = [
  ['PH_BDO', 'BDO Unibank'], ['PH_BPI', 'BPI'], ['PH_MET', 'Metrobank'], ['PH_LBP', 'Land Bank'],
  ['PH_PNB', 'PNB'], ['PH_UBP', 'UnionBank'], ['PH_RCBC', 'RCBC'], ['PH_SEC', 'Security Bank'],
  ['PH_CBC', 'China Bank'], ['PH_EWB', 'EastWest Bank'],
];

/** Add a GCash, Maya or bank payout method. Only asks for a bank when "Bank account" is chosen. */
export function PayoutMethodForm() {
  const [kind, setKind] = useState('gcash');
  const [bank, setBank] = useState('PH_BDO');
  const isBank = kind === 'bank';
  return (
    <ActionForm action={addPayoutMethod} className="grid gap-3 border-t border-line pt-3" resetOnSuccess>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type" htmlFor="kind">
          <Select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="gcash">GCash</option><option value="maya">Maya</option><option value="bank">Bank account</option>
          </Select>
        </Field>
        {isBank && (
          <Field label="Bank" htmlFor="bank_pick">
            <Select id="bank_pick" value={bank} onChange={(e) => setBank(e.target.value)}>
              {BANKS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              <option value="">Other…</option>
            </Select>
          </Field>
        )}
      </div>
      {isBank && bank === '' && (
        <Field label="Bank code" htmlFor="bank_code" hint="As your bank lists it for transfers, e.g. PH_AUB."><Input id="bank_code" name="bank_code" required /></Field>
      )}
      {isBank && bank !== '' && <input type="hidden" name="bank_code" value={bank} />}
      <Field label="Account name" htmlFor="account_name" hint="Must match your verified legal name."><Input id="account_name" name="account_name" required autoComplete="name" /></Field>
      <Field label={isBank ? 'Account number' : `${kind === 'maya' ? 'Maya' : 'GCash'} mobile number`} htmlFor="account_number"
        hint={isBank ? '6–20 digits.' : '11 digits starting with 09.'}>
        <Input id="account_number" name="account_number" required inputMode="numeric" autoComplete="off" />
      </Field>
      <SubmitButton variant="secondary">Save payout method</SubmitButton>
    </ActionForm>
  );
}
