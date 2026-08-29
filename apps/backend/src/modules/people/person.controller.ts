import type { Request, Response } from "express";
import * as personService from "@/modules/people/person.service";
import type {
  CreatePersonInput,
  ListPeopleQuery,
  UpdatePersonInput,
} from "@/modules/people/person.schema";

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListPeopleQuery;
  const result = await personService.listPeople(query);
  res.status(200).json(result);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const person = await personService.getPersonById(req.params.id as string);
  res.status(200).json({ person });
}

export async function create(req: Request, res: Response): Promise<void> {
  const input = req.body as CreatePersonInput;
  const person = await personService.createPerson(input);
  res.status(201).json({ person });
}

export async function update(req: Request, res: Response): Promise<void> {
  const input = req.body as UpdatePersonInput;
  const person = await personService.updatePerson(req.params.id as string, input);
  res.status(200).json({ person });
}
