import { Card } from '@/components/ui';

export default function Suspended() {
  return (
    <Card className="grid gap-3">
      <h1 className="text-2xl font-bold">Your account is suspended</h1>
      <p className="text-muted">You can&apos;t post, pitch or message while your account is suspended. If you think this is a mistake, email our support team with your account email.</p>
      <form action="/auth/signout" method="post"><button className="text-sm font-semibold text-accent">Log out</button></form>
    </Card>
  );
}
