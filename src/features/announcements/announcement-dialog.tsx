"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { saveAnnouncement } from "./actions";
import type { Announcement } from "./queries";
import { announcementSchema } from "./schemas";

export function AnnouncementDialog({ announcement }: { announcement?: Announcement }) {
  const [open, setOpen] = useState(false);
  const editing = Boolean(announcement);
  const defaults = {
    id: announcement?.id ?? "",
    title: announcement?.title ?? "",
    body: announcement?.body ?? "",
    pinned: announcement?.pinned ?? false,
    publish: announcement ? Boolean(announcement.publishedAt) : true,
  };
  const form = useForm({ resolver: zodResolver(announcementSchema), defaultValues: defaults });
  const { onSubmit, pending, error } = useActionForm(form, saveAnnouncement, {
    onSuccess: () => {
      setOpen(false);
      if (!editing) form.reset(defaults);
    },
  });
  const errors = form.formState.errors;
  const publish = useWatch({ control: form.control, name: "publish" });
  const pinned = useWatch({ control: form.control, name: "pinned" });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="sm">
            Edit
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden /> New announcement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit announcement" : "New announcement"}</DialogTitle>
          <DialogDescription>Published announcements appear on every boarder&apos;s home screen.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          <Field label="Title" error={errors.title?.message}>
            {(p) => <Input {...p} placeholder="Water interruption on Saturday" {...form.register("title")} />}
          </Field>
          <Field label="Message" error={errors.body?.message}>
            {(p) => <Textarea {...p} rows={6} placeholder="Maynilad will cut the supply from 9 AM to 12 NN. Please store water the night before." {...form.register("body")} />}
          </Field>
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <Checkbox id="ann-publish" checked={publish} onCheckedChange={(v) => form.setValue("publish", v === true)} />
              <Label htmlFor="ann-publish" className="text-sm font-normal">
                Publish now (leave unchecked to save a draft)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ann-pinned" checked={pinned} onCheckedChange={(v) => form.setValue("pinned", v === true)} />
              <Label htmlFor="ann-pinned" className="text-sm font-normal">
                Pin to the top
              </Label>
            </div>
          </div>
          <DialogFooter>
            <SubmitButton pending={pending}>{publish ? (editing ? "Save" : "Publish") : "Save draft"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
