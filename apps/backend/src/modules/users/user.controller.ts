import type { Request, Response } from "express";
import * as userService from "@/modules/users/user.service";
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from "@/modules/users/user.schema";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await userService.listUsers(req.query as unknown as ListUsersQuery);
  res.status(200).json(result);
}

export async function create(req: Request, res: Response): Promise<void> {
  const user = await userService.createUser(req.body as CreateUserInput);
  res.status(201).json({ user });
}

export async function update(req: Request, res: Response): Promise<void> {
  const user = await userService.updateUser(req.user!.id, req.params.id as string, req.body as UpdateUserInput);
  res.status(200).json({ user });
}

export async function joinLoyalty(req: Request, res: Response): Promise<void> {
  const user = await userService.joinLoyaltyProgram(req.user!.id);
  res.status(200).json({ user });
}
