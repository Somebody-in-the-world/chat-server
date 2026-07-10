import { Router, type Application, type NextFunction, type Request, type Response } from "express";
import * as z from "zod";
import httpStatus from "http-status";
import type { UnionToIntersection } from "type-fest";

type OpenApiRouterMethod = ReturnType<typeof createRouterMethod>;
const HTTP_METHODS = [
    "get",
    "post",
    "patch",
    "put",
    "delete",
    "head",
    "options",
    "connect",
    "trace"
] as const;
type HttpMethods = (typeof HTTP_METHODS)[number];

export type OpenApiRouter = {
    router: Router;
    prefix: string;
    openapi: {
        tags?: string[];
    };
    attach(app: Application): void;
} & { [x in HttpMethods]: OpenApiRouterMethod };

type HandlerType<
    TBody extends z.ZodType,
    TResponses extends Record<number, z.ZodType>,
    TParams extends z.ZodObject<{
        [x: string]: z.ZodString;
    }>,
    TQuery extends z.ZodObject<{
        [x: string]: z.ZodString;
    }>,
    TLocals extends Record<string, unknown>
> = (
    req: Request<
        z.infer<TParams>,
        z.infer<TResponses[keyof TResponses]>,
        z.infer<TBody>,
        z.infer<TQuery>
    >,
    res: Response<z.infer<TResponses[keyof TResponses]>, TLocals>,
    next: NextFunction
) => unknown;

type SecurityScheme = {
    type: "http";
    description?: string;
    scheme: "basic" | "digest" | "bearer";
    bearerFormat?: string;
};

type MetaType<
    TBody extends z.ZodType,
    TResponses extends Record<number, z.ZodType>,
    TParams extends ZodStringRecord,
    TQuery extends ZodStringRecord
> = {
    description?: string;
    body?: TBody;
    responses?: TResponses;
    params?: TParams;
    query?: TQuery;
    security?: SecurityScheme;
};

type ZodStringRecord = z.ZodObject<{
    [x: string]: z.ZodString;
}>;

const endpoints = new Map<
    string,
    Map<
        string,
        {
            body?: z.ZodType;
            description?: string;
            responses?: Record<number, z.ZodType>;
            params?: ZodStringRecord;
            query?: ZodStringRecord;
            security?: SecurityScheme;
            tags?: string[];
        }
    >
>();

export function OpenApiRouter(prefix: string, options?: { tags?: string[] }) {
    const internalRouter = Router();
    const router: OpenApiRouter = {
        router: internalRouter,
        prefix,
        openapi: options ?? {},
        attach(app) {
            app.use(prefix, internalRouter);
        }
    } as OpenApiRouter;
    for (const method of HTTP_METHODS) {
        router[method] = createRouterMethod(router, method.toUpperCase());
    }

    return router;
}

export function OpenApiMiddleware<
    IsExternal extends boolean,
    Cb extends (
        req: IsExternal extends true
            ? Request
            : Request<unknown, z.infer<TResponses[keyof TResponses]>, unknown, TLocals>,
        res: IsExternal extends true
            ? Response
            : Response<z.infer<TResponses[keyof TResponses]>, TLocals>,
        next: NextFunction
    ) => unknown,
    TLocals extends Record<string, unknown> = Record<number, never>,
    TResponses extends Record<number, z.ZodType> = Record<number, never>
>(
    meta: {
        responses?: TResponses;
        locals?: z.ZodType<TLocals>;
        security?: SecurityScheme;
        // use more lenient types in order to be compatible with external middleware
        external?: IsExternal;
    },
    cb: Cb
) {
    const newCb = cb as Cb & {
        responses: TResponses;
        locals: TLocals;
        security?: SecurityScheme;
    };
    newCb.responses = meta.responses! ?? {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    newCb.locals = (meta.locals! ?? {}) as any;
    newCb.security = meta.security;
    return newCb;
}

function routeAny<
    TBody extends z.ZodType,
    TResponse extends Record<number, z.ZodType>,
    H extends { responses: Record<number, z.ZodType>; locals: Record<string, unknown> }[],
    TParams extends ZodStringRecord = ZodStringRecord,
    TQuery extends ZodStringRecord = ZodStringRecord,
    TLocals extends Record<string, unknown> = Record<string, unknown>
>(
    router: OpenApiRouter,
    method: string,
    route: string,
    meta: MetaType<TBody, TResponse, TParams, TQuery>,
    ...handlers: [
        ...H,
        HandlerType<
            TBody,
            TResponse & UnionToIntersection<H[number]["responses"]>,
            TParams,
            TQuery,
            TLocals & UnionToIntersection<H[number]["locals"]>
        >
    ]
) {
    const { body, params, query } = meta;
    const openapiRoute = router.prefix + route.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");
    if (!endpoints.has(openapiRoute)) endpoints.set(openapiRoute, new Map());
    endpoints.get(openapiRoute)!.set(method.toLowerCase(), {
        ...meta,
        responses: Object.assign(
            {},
            meta.responses,
            ...handlers.map((handler) => ("responses" in handler ? handler.responses : {}))
        ),
        security: Object.assign(
            {},
            meta.security,
            ...handlers.map((handler) => ("security" in handler ? handler.security : {}))
        ),
        ...router.openapi
    });

    const useRouterAll = !HTTP_METHODS.includes(method.toLowerCase() as HttpMethods);

    router.router[useRouterAll ? "all" : (method.toLowerCase() as HttpMethods)]?.(
        route,
        (req, res, next) => {
            if (useRouterAll) {
                if (req.method.toUpperCase() !== method) {
                    next();
                    return;
                }
            }
            const bodyParseResult = body?.safeParse(req.body);
            if (bodyParseResult && !bodyParseResult.success) {
                res.status(400).send(z.treeifyError(bodyParseResult.error));
                return;
            }

            const paramsParseResult = params?.safeParse(req.params);
            if (paramsParseResult && !paramsParseResult.success) {
                res.status(400).send(z.treeifyError(paramsParseResult.error));
                return;
            }

            const queryParseResult = query?.safeParse(req.query);
            if (queryParseResult && !queryParseResult.success) {
                res.status(400).send(z.treeifyError(queryParseResult.error));
                return;
            }

            const runHandler = (index: number) => {
                if (index >= handlers.length) return;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (handlers[index] as any)(req as any, res as any, (err?: unknown) => {
                    if (err) return next(err);
                    runHandler(index + 1);
                });
            };

            runHandler(0);
        }
    );
}

function createRouterMethod(router: OpenApiRouter, method: string) {
    return <
        TBody extends z.ZodType,
        TResponses extends Record<number, z.ZodType>,
        H extends { responses: Record<number, z.ZodType>; locals: Record<string, unknown> }[],
        TParams extends ZodStringRecord = ZodStringRecord,
        TQuery extends ZodStringRecord = ZodStringRecord,
        TLocals extends Record<string, unknown> = Record<string, unknown>
    >(
        route: string,
        meta: MetaType<TBody, TResponses, TParams, TQuery>,
        ...handlers: [
            ...H,
            HandlerType<
                TBody,
                TResponses & UnionToIntersection<H[number]["responses"]>,
                TParams,
                TQuery,
                TLocals & UnionToIntersection<H[number]["locals"]>
            >
        ]
    ) => {
        routeAny(router, method, route, meta, ...handlers);
    };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapObject<TObject extends Record<string, any>, TReturn>(
    obj: TObject,
    fn: <K extends keyof TObject>(value: TObject[K], key: K, index: number) => TReturn
): {
    [K in keyof TObject]: TReturn;
} {
    return Object.fromEntries(
        Object.entries(obj).map(([key, value], index) => [
            key,
            fn(value, key as keyof TObject, index)
        ])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ) as any;
}
export function buildOpenApiDocument(config?: {
    openapi?: string;
    info?: { title?: string; version?: string };
    servers?: {
        url?: string;
        description?: string;
    }[];
}) {
    function capitalize(str: string) {
        if (!str) return "";
        return str[0]?.toUpperCase() + str.slice(1);
    }

    function securityToId(security: SecurityScheme) {
        return `${capitalize(security.type)}${capitalize(security.scheme)}`;
    }

    const openapi = {
        openapi: config?.openapi ?? "3.1.0",
        info: config?.info,
        servers: config?.servers,
        components: {
            securitySchemes: {} as Record<string, SecurityScheme>
        },
        paths: mapObject(Object.fromEntries(endpoints), (val) =>
            mapObject(Object.fromEntries(val), (endpoint, method) => ({
                description: endpoint.description,
                tags: endpoint.tags,
                security:
                    endpoint.security === undefined || Object.keys(endpoint.security).length === 0
                        ? undefined
                        : [
                              {
                                  [securityToId(endpoint.security)]: []
                              }
                          ],
                parameters: [
                    ...Object.entries(endpoint.params?.shape ?? {}).map(([name]) => ({
                        name,
                        in: "path",
                        required: true
                    })),
                    ...Object.entries(endpoint.query?.shape ?? {}).map(([name]) => ({
                        name,
                        in: "query",
                        required: true
                    }))
                ],
                requestBody:
                    ["get", "head", "options", "delete"].includes(method as string) ||
                    endpoint.body?.def.type === "void"
                        ? undefined
                        : {
                              content: {
                                  "application/json": {
                                      schema: endpoint.body?.toJSONSchema(),
                                      required: true
                                  }
                              }
                          },
                responses: mapObject(endpoint.responses ?? {}, (val, code) => ({
                    content:
                        val.def.type === "void"
                            ? undefined
                            : {
                                  "application/json": {
                                      schema: val.toJSONSchema()
                                  }
                              },
                    description:
                        (httpStatus as Record<number, string | undefined>)[code] ?? "Unknown"
                }))
            }))
        )
    };

    const securitySchemes: Record<string, SecurityScheme> = {};
    Object.keys(Object.fromEntries(endpoints)).map((route) => {
        Object.keys(Object.fromEntries(endpoints.get(route) ?? new Map())).map((method) => {
            const scheme = endpoints.get(route)?.get(method)?.security;
            if (scheme && Object.keys(scheme).length !== 0) {
                securitySchemes[securityToId(scheme)] = scheme;
            }
        });
    });
    openapi.components.securitySchemes = securitySchemes;
    return openapi;
}
