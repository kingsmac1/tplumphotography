-- =====================================================================
-- Tplum email templates (editable in Dashboard -> Emails & Messaging -> Templates).
-- Same keys and placeholders as DMI, rewritten for Tplum; {{summary}} = the detail rows + total block,
-- {{details}} = the full submission table (studio copies). An edited template is never overwritten.
-- =====================================================================
insert into public.email_templates (key, subject, body) values
('booking_confirmation', 'Your Tplum Photography booking is confirmed', $t$<p>Hi {{client_name}},</p>
<p>Thank you for booking with Tplum Photography! Here is a summary of your session:</p>
{{summary}}
<p>If anything changes, or you have questions before your session, just reply to this email.</p>
<p>We can't wait to capture your meaningful moments.</p>
<p>Warm regards,<br/>Tplum Photography</p>$t$),
('studio_confirmation', 'Your Tplum studio booking', $t$<p>Hi {{client_name}},</p>
<p>Thanks for booking our studio space! Here is a summary:</p>
{{summary}}
<p>Please arrive a few minutes early so you can use your full time. Reply to this email if you have any questions.</p>
<p>See you soon,<br/>Tplum Photography</p>$t$),
('event_confirmation', 'We received your event request', $t$<p>Hi {{client_name}},</p>
<p>Thank you for your event request. Here is what you sent us:</p>
{{summary}}
<p>Kindly allow 24–48 hours for a reply. We'll confirm the final arrangement with you by email or phone.</p>
<p>Warm regards,<br/>Tplum Photography</p>$t$),
('reminder_24h', 'Reminder: your session is tomorrow', $t$<p>Hi {{client_name}},</p>
<p>Just a reminder that your photography session is coming up in the next 24 hours.</p>
{{summary}}
<p>Please have your outfit(s) and any props ready. If you have any questions, reply to this email.</p>
<p>See you soon!<br/>Tplum Photography</p>$t$),
('reminder_12h', '12 hours to go: your Tplum session', $t$<p>Hi {{client_name}},</p>
<p>Your session is just 12 hours away!</p>
{{summary}}
<p>Get a good night's rest, and please arrive a few minutes early so we can start on time.</p>
<p>Looking forward to it,<br/>Tplum Photography</p>$t$),
('reminder_2h', 'Almost time! Your session is in 2 hours', $t$<p>Hi {{client_name}},</p>
<p>Your session starts in about 2 hours.</p>
{{summary}}
<p>See you shortly!<br/>Tplum Photography</p>$t$),
('thank_you', 'Thank you for booking with Tplum Photography', $t$<p>Hi {{client_name}},</p>
<p>A genuine thank you for choosing Tplum Photography. We're excited to work with you!</p>
<p>If you have any questions before your session, reply to this email anytime.</p>
<p>Warm regards,<br/>Tplum Photography</p>$t$),
('review_request', 'How was your Tplum Photography experience?', $t$<p>Hi {{client_name}},</p>
<p>We hope you're loving your photos! If you have a moment, we'd really appreciate a short review. It helps other couples and families find us.</p>
<p>Thank you for trusting us with your story.</p>
<p>Warm regards,<br/>Tplum Photography</p>$t$),
('re_engagement', 'Ready for your next session?', $t$<p>Hi {{client_name}},</p>
<p>It's been a little while since your last session with Tplum Photography. We'd love to capture your next chapter, whether that's an anniversary, a family portrait or a milestone.</p>
<p>Warm regards,<br/>Tplum Photography</p>$t$),
('birthday', 'Happy birthday from Tplum Photography', $t$<p>Hi {{client_name}},</p>
<p>Happy birthday from all of us at Tplum Photography! We hope your day is full of joy and moments worth remembering.</p>
<p>Warm regards,<br/>Tplum Photography</p>$t$),
('payment_paid', 'Payment received. Thank you!', $t$<p>Hi {{client_name}},</p>
<p>We've received your payment for <strong>{{item}}</strong>. Thank you!</p>
{{summary}}
<p>If you have any questions, just reply to this email.</p>
<p>Warm regards,<br/>Tplum Photography</p>$t$),
('payment_part', 'Payment received. Thank you!', $t$<p>Hi {{client_name}},</p>
<p>We've received your payment of <strong>{{amount_paid}}</strong> for <strong>{{item}}</strong>. Thank you!</p>
{{summary}}
<p>Your remaining balance is <strong>{{balance}}</strong>, due before your date. Reply to this email if you'd like to arrange it.</p>
<p>Warm regards,<br/>Tplum Photography</p>$t$),
('balance_reminder', 'Reminder: your balance of {{balance}} is due', $t$<p>Hi {{client_name}},</p>
<p>A friendly reminder that the balance for <strong>{{item}}</strong> is due before your date.</p>
{{summary}}
<p>You can pay by Interac e-Transfer or online with the button below. Reply to this email if you have any questions.</p>
<p>Warm regards,<br/>Tplum Photography</p>$t$),
('invoice_overdue', 'Invoice {{invoice_number}} is overdue', $t$<p>Hi {{client_name}},</p>
<p>Our records show that invoice <strong>{{invoice_number}}</strong> was due on {{due_date}} and has a balance of <strong>{{balance}}</strong>.</p>
{{summary}}
<p>If you've already paid, thank you, and please ignore this message. Otherwise you can view and pay your invoice online.</p>
<p>Warm regards,<br/>Tplum Photography</p>$t$),
('owner_booking', 'New booking: {{client_name}} · {{shoot_date}}', $t$<p>A new booking has been confirmed on the website.</p>
{{details}}$t$),
('owner_studio', 'New studio rental: {{client_name}} · {{rental_date}}', $t$<p>A new studio rental was booked on the website.</p>
{{details}}$t$),
('owner_event', 'New event request: {{client_name}} · {{event_type}}', $t$<p>A new event request came in from the website.</p>
{{details}}$t$),
('owner_birthday', '{{client_count}} client birthday(s) today', $t$<p>Good morning! These clients have a birthday today ({{date}}). They are also receiving the birthday email.</p>
<p>{{details}}</p>$t$)
on conflict (key) do nothing;
