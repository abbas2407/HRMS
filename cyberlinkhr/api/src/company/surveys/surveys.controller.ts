import { Request, Response } from 'express';
import { eq, desc, sql, and, count } from 'drizzle-orm';
import { surveys, surveyQuestions, surveyResponses, surveyAnswers, employees } from '../../shared/db/tenant.schema';
import { z } from 'zod';

const questionSchema = z.object({
  questionText: z.string().min(1),
  questionType: z.enum(['TEXT', 'RATING', 'MULTIPLE_CHOICE', 'YES_NO']),
  options: z.array(z.string()).default([]),
  required: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const surveySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(['ANONYMOUS', 'NAMED']).default('NAMED'),
  deadline: z.string().optional(),
  targetRole: z.enum(['HR_ADMIN', 'MANAGER', 'EMPLOYEE', '']).optional(),
  questions: z.array(questionSchema).min(1),
});

export async function listSurveys(req: Request, res: Response) {
  const isAdmin = req.user?.role === 'HR_ADMIN';
  const empId = req.user?.employeeId;
  const role = req.user?.role;

  const rows = await req.runInTenant!(async (db) =>
    db.select({
      id: surveys.id,
      title: surveys.title,
      type: surveys.type,
      status: surveys.status,
      deadline: surveys.deadline,
      targetRole: surveys.targetRole,
      createdAt: surveys.createdAt,
      responseCount: sql<number>`(SELECT COUNT(*) FROM "${sql.raw(req.user!.schemaName)}".survey_responses sr WHERE sr.survey_id = ${surveys.id})`,
      myResponse: empId
        ? sql<string | null>`(SELECT sr.id FROM "${sql.raw(req.user!.schemaName)}".survey_responses sr WHERE sr.survey_id = ${surveys.id} AND sr.respondent_id = ${empId} LIMIT 1)`
        : sql<null>`NULL`,
    })
      .from(surveys)
      .where(
        isAdmin
          ? sql`1=1`
          : and(
              eq(surveys.status, 'ACTIVE'),
              sql`(${surveys.targetRole} IS NULL OR ${surveys.targetRole} = '' OR ${surveys.targetRole} = ${role})`
            )
      )
      .orderBy(desc(surveys.createdAt))
  );
  return res.json({ data: rows });
}

export async function getSurvey(req: Request, res: Response) {
  const { id } = req.params;
  const [s] = await req.runInTenant!(async (db) =>
    db.select().from(surveys).where(eq(surveys.id, id))
  );
  if (!s) return res.status(404).json({ error: 'Not found' });

  const questions = await req.runInTenant!(async (db) =>
    db.select().from(surveyQuestions)
      .where(eq(surveyQuestions.surveyId, id))
      .orderBy(surveyQuestions.sortOrder)
  );
  return res.json({ data: { ...s, questions } });
}

export async function createSurvey(req: Request, res: Response) {
  const parsed = surveySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { questions: qs, ...rest } = parsed.data;

  const [survey] = await req.runInTenant!(async (db) =>
    db.insert(surveys).values({
      title: rest.title,
      description: rest.description || null,
      type: rest.type,
      deadline: rest.deadline || null,
      targetRole: rest.targetRole || null,
      createdBy: req.user!.userId,
    }).returning()
  );

  await req.runInTenant!(async (db) =>
    db.insert(surveyQuestions).values(
      qs.map((q, i) => ({
        surveyId: survey.id,
        questionText: q.questionText,
        questionType: q.questionType,
        options: q.options,
        required: q.required,
        sortOrder: i,
      }))
    )
  );

  return res.status(201).json({ data: survey });
}

export async function updateStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;
  if (!['DRAFT', 'ACTIVE', 'CLOSED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const [row] = await req.runInTenant!(async (db) =>
    db.update(surveys).set({ status, updatedAt: new Date() }).where(eq(surveys.id, id)).returning()
  );
  return res.json({ data: row });
}

export async function submitResponse(req: Request, res: Response) {
  const { id } = req.params;
  const empId = req.user?.employeeId;
  const { answers } = req.body;

  if (!Array.isArray(answers) || !answers.length) {
    return res.status(400).json({ error: 'Answers required' });
  }

  const [s] = await req.runInTenant!(async (db) =>
    db.select({ status: surveys.status, type: surveys.type })
      .from(surveys).where(eq(surveys.id, id))
  );
  if (!s) return res.status(404).json({ error: 'Survey not found' });
  if (s.status !== 'ACTIVE') return res.status(400).json({ error: 'Survey is not active' });

  // Prevent duplicate submissions for named surveys
  if (s.type === 'NAMED' && empId) {
    const [existing] = await req.runInTenant!(async (db) =>
      db.select({ id: surveyResponses.id }).from(surveyResponses)
        .where(and(eq(surveyResponses.surveyId, id), eq(surveyResponses.respondentId, empId)))
    );
    if (existing) return res.status(409).json({ error: 'Already submitted' });
  }

  const [response] = await req.runInTenant!(async (db) =>
    db.insert(surveyResponses).values({
      surveyId: id,
      respondentId: s.type === 'NAMED' ? empId || null : null,
    }).returning()
  );

  await req.runInTenant!(async (db) =>
    db.insert(surveyAnswers).values(
      answers.map((a: any) => ({
        responseId: response.id,
        questionId: a.questionId,
        answerText: a.answerText || null,
        answerRating: a.answerRating != null ? Number(a.answerRating) : null,
        answerChoice: a.answerChoice || null,
      }))
    )
  );

  return res.status(201).json({ data: response });
}

export async function getAnalytics(req: Request, res: Response) {
  const { id } = req.params;
  const [s] = await req.runInTenant!(async (db) =>
    db.select({ id: surveys.id, title: surveys.title, type: surveys.type })
      .from(surveys).where(eq(surveys.id, id))
  );
  if (!s) return res.status(404).json({ error: 'Not found' });

  const questions = await req.runInTenant!(async (db) =>
    db.select().from(surveyQuestions)
      .where(eq(surveyQuestions.surveyId, id))
      .orderBy(surveyQuestions.sortOrder)
  );

  const [{ total }] = await req.runInTenant!(async (db) =>
    db.select({ total: count() }).from(surveyResponses).where(eq(surveyResponses.surveyId, id))
  );

  const analytics = await Promise.all(questions.map(async (q) => {
    const answers = await req.runInTenant!(async (db) =>
      db.select({
        answerText: surveyAnswers.answerText,
        answerRating: surveyAnswers.answerRating,
        answerChoice: surveyAnswers.answerChoice,
      })
        .from(surveyAnswers)
        .innerJoin(surveyResponses, eq(surveyAnswers.responseId, surveyResponses.id))
        .where(and(
          eq(surveyAnswers.questionId, q.id),
          eq(surveyResponses.surveyId, id)
        ))
    );

    if (q.questionType === 'RATING') {
      const ratings = answers.map(a => a.answerRating).filter(Boolean) as number[];
      const avg = ratings.length ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1) : null;
      const distribution: Record<number, number> = {};
      ratings.forEach(r => { distribution[r] = (distribution[r] || 0) + 1; });
      return { ...q, avg, distribution, answerCount: ratings.length };
    }

    if (q.questionType === 'MULTIPLE_CHOICE' || q.questionType === 'YES_NO') {
      const tally: Record<string, number> = {};
      answers.forEach(a => {
        const v = a.answerChoice || '';
        if (v) tally[v] = (tally[v] || 0) + 1;
      });
      return { ...q, tally, answerCount: answers.length };
    }

    // TEXT
    return { ...q, textAnswers: answers.map(a => a.answerText).filter(Boolean), answerCount: answers.length };
  }));

  return res.json({ data: { survey: s, totalResponses: Number(total), questions: analytics } });
}
