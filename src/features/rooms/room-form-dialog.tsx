"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError, SubmitButton } from "@/components/app/form";
import { useActionForm } from "@/components/app/use-action-form";
import { centavosToInput } from "@/lib/money";
import { createRoom, updateRoom } from "./actions";
import type { PropertyOption, RoomView } from "./queries";
import { roomSchema } from "./schemas";

export function RoomFormDialog({ properties, room }: { properties: PropertyOption[]; room?: RoomView }) {
  const [open, setOpen] = useState(false);
  const editing = Boolean(room);
  const form = useForm({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      propertyId: room?.propertyId ?? properties[0]?.id ?? "",
      code: room?.code ?? "",
      floor: room?.floor ?? "",
      capacity: room?.capacity ?? 2,
      rate: room ? centavosToInput(room.rate) : "",
      notes: room?.notes ?? "",
    },
  });
  const { onSubmit, pending, error } = useActionForm(
    form,
    (values) => (room ? updateRoom({ ...values, id: room.id }) : createRoom(values)),
    {
      onSuccess: () => {
        setOpen(false);
        if (!editing) form.reset();
      },
    },
  );
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="outline">Edit room</Button>
        ) : (
          <Button>
            <Plus aria-hidden /> Add room
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit room ${room?.code}` : "Add a room"}</DialogTitle>
          <DialogDescription>
            {editing ? "Rate changes apply to new assignments and future invoices only." : "Beds are created for each slot of capacity. You can rename them after."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error} />
          {!editing && properties.length > 1 && (
            <Field label="Property" error={errors.propertyId?.message}>
              {(p) => (
                <select {...p} {...form.register("propertyId")} className="h-9 rounded-md border border-input bg-background px-2.5 text-sm">
                  {properties.map((prop) => (
                    <option key={prop.id} value={prop.id}>
                      {prop.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Room number" error={errors.code?.message}>
              {(p) => <Input {...p} placeholder="e.g. 201" {...form.register("code")} />}
            </Field>
            <Field label="Floor" error={errors.floor?.message}>
              {(p) => <Input {...p} placeholder="e.g. 2nd" {...form.register("floor")} />}
            </Field>
            <Field label="Capacity (beds)" error={errors.capacity?.message}>
              {(p) => <Input {...p} type="number" min={1} max={20} inputMode="numeric" {...form.register("capacity")} />}
            </Field>
            <Field label="Monthly rate per bed (₱)" error={errors.rate?.message}>
              {(p) => <Input {...p} inputMode="decimal" placeholder="3,500" {...form.register("rate")} />}
            </Field>
          </div>
          <Field label="Notes" error={errors.notes?.message}>
            {(p) => <Textarea {...p} rows={2} placeholder="Aircon, own CR, window to the street…" {...form.register("notes")} />}
          </Field>
          <DialogFooter>
            <SubmitButton pending={pending}>{editing ? "Save room" : "Add room"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
