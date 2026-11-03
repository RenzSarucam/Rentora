"use client";

import { useId, useState } from "react";
import Form from "next/form";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReportRange } from "./queries";

export function ReportFilters({ range }: { range: ReportRange }) {
  const id = useId();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [months, setMonths] = useState(String(range.months));

  function resetFields() {
    setFrom(range.currentMonth);
    setTo(range.today);
    setMonths("6");
  }

  return (
    <Form action="/admin/reports" scroll={false} aria-label="Report filters" className="mb-8 grid min-w-0 items-end gap-4 rounded-lg border border-border bg-raised/60 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
      <div className="grid min-w-0 gap-2 text-xs text-muted-foreground">
        <label htmlFor={`${id}-from`}>Payments from</label>
        <Input id={`${id}-from`} type="date" name="from" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 w-full bg-background px-3" />
      </div>
      <div className="grid min-w-0 gap-2 text-xs text-muted-foreground">
        <label htmlFor={`${id}-to`}>Payments to</label>
        <Input id={`${id}-to`} type="date" name="to" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 w-full bg-background px-3" />
      </div>
      <div className="grid min-w-0 gap-2 text-xs text-muted-foreground">
        <label htmlFor={`${id}-months`}>Collections chart</label>
        <select id={`${id}-months`} name="months" value={months} onChange={(event) => setMonths(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background text-sm text-foreground">
          <option value="6">Last 6 months</option>
          <option value="12">Last 12 months</option>
        </select>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" variant="outline" className="h-10 px-4">Apply</Button>
        <Button asChild variant="ghost" className="h-10 gap-2 px-4 text-muted-foreground">
          <Link href="/admin/reports" scroll={false} onClick={resetFields}><RotateCcw className="size-4" aria-hidden />Reset</Link>
        </Button>
      </div>
    </Form>
  );
}
