# NestJS Guidelines (Audit-Only)

## Overview
NestJS is **not used for new services** in this standard. These guidelines exist solely for
auditing and improving existing NestJS applications. When auditing, check for the patterns
below and flag deviations. For any new backend service, use Fastify instead.

## Rules

### [REQUIRED] Feature module organisation — one module per domain
- **What:** Each domain (users, orders, billing…) lives in its own module folder with its own
  `*.module.ts`. A `SharedModule` exports cross-cutting providers (logger, config, database).
- **Config:**
  ```ts
  // src/users/users.module.ts
  @Module({
    imports: [TypeOrmModule.forFeature([UserEntity])],
    controllers: [UsersController],
    providers: [UsersService, UsersRepository],
    exports: [UsersService],
  })
  export class UsersModule {}
  ```
- **Why:** Keeps dependency graphs explicit; avoids the God-module anti-pattern where
  everything imports everything.

### [REQUIRED] Controller → Service → Repository layering
- **What:** Controllers handle HTTP concerns only (parse DTO, call service, return response).
  Services hold business logic. Repositories wrap DB access. No business logic in controllers;
  no HTTP concerns in services.
- **Config:**
  ```ts
  @Controller('users')
  export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get(':id')
    async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
      return this.usersService.findById(id);
    }
  }
  ```
- **Why:** Each layer is independently testable; services can be reused by other modules
  (e.g. event handlers) without touching HTTP context.

### [REQUIRED] Use Guards for authentication and authorisation
- **What:** Implement `CanActivate` for JWT verification and role checks. Apply globally via
  `APP_GUARD` or per-route with `@UseGuards()`. Never check tokens inside services.
- **Config:**
  ```ts
  @Injectable()
  export class JwtAuthGuard extends AuthGuard('jwt') {}

  // Global registration in AppModule:
  { provide: APP_GUARD, useClass: JwtAuthGuard }

  // Route-level override:
  @Public()   // custom decorator that skips the global guard
  @Get('health')
  health() { return { status: 'ok' }; }
  ```
- **Why:** Centralises auth logic; guards run before interceptors and pipes, enforcing the
  correct NestJS lifecycle order.

### [REQUIRED] Use Interceptors for response transformation and logging
- **What:** Apply a `TransformInterceptor` globally to wrap all responses in a consistent
  envelope (`{ data, meta }`). Apply a `LoggingInterceptor` for request/response timing.
- **Config:**
  ```ts
  @Injectable()
  export class TransformInterceptor<T>
    implements NestInterceptor<T, { data: T }> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<{ data: T }> {
      return next.handle().pipe(map((data) => ({ data })));
    }
  }
  ```
- **Why:** Keeps controllers clean; response shape is consistent across the entire API.

### [REQUIRED] Use Pipes for input validation — prefer Valibot over class-validator
- **What:** For existing apps using `class-validator`, keep using `ValidationPipe` globally.
  When adding new features or migrating, prefer Valibot schemas with a custom pipe.
- **Config (existing — class-validator):**
  ```ts
  // main.ts
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  ```
- **Config (Valibot migration path):**
  ```ts
  @Injectable()
  export class ValibotPipe implements PipeTransform {
    constructor(private schema: BaseSchema) {}
    transform(value: unknown) {
      const result = safeParse(this.schema, value);
      if (!result.success) throw new BadRequestException(result.issues);
      return result.output;
    }
  }

  // In controller:
  @Post()
  create(@Body(new ValibotPipe(CreateUserSchema)) dto: CreateUserDto) { ... }
  ```
- **Why:** `whitelist: true` strips unknown properties automatically. Valibot is the standard
  contract library; migrate towards it when modifying existing endpoints.

### [REQUIRED] Use Exception Filters for consistent error responses
- **What:** Implement a global `HttpExceptionFilter` that catches all exceptions and emits a
  standardised JSON error shape matching the rest of the platform.
- **Config:**
  ```ts
  @Catch()
  export class AllExceptionsFilter implements ExceptionFilter {
    constructor(private readonly logger: Logger) {}

    catch(exception: unknown, host: ArgumentsHost) {
      const ctx = host.switchToHttp();
      const response = ctx.getResponse<Response>();
      const request = ctx.getRequest<Request>();
      const status =
        exception instanceof HttpException ? exception.getStatus() : 500;
      const message =
        exception instanceof HttpException
          ? exception.message
          : 'Internal Server Error';

      if (status >= 500) {
        this.logger.error({ exception }, 'Unhandled exception');
      }

      response.status(status).json({ statusCode: status, message, path: request.url });
    }
  }

  // main.ts
  app.useGlobalFilters(new AllExceptionsFilter(logger));
  ```
- **Why:** Prevents stack trace leakage; keeps error shape consistent with Fastify services.

### [REQUIRED] Dependency injection — inject interfaces, bind in module
- **What:** Services should depend on abstract interfaces or tokens, not concrete classes.
  Bind implementations in the module's `providers` array.
- **Config:**
  ```ts
  export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

  @Module({
    providers: [
      { provide: USER_REPOSITORY, useClass: DrizzleUsersRepository },
      UsersService,
    ],
  })
  export class UsersModule {}

  @Injectable()
  export class UsersService {
    constructor(
      @Inject(USER_REPOSITORY) private readonly userRepo: IUsersRepository,
    ) {}
  }
  ```
- **Why:** Makes services testable with mock repositories without touching module wiring.

### [RECOMMENDED] Unit test services; e2e test controllers
- **What:** Unit tests use `Test.createTestingModule` with mocked providers. E2e tests spin up
  the full Nest app with `supertest`.
- **Config:**
  ```ts
  // users.service.spec.ts
  const module = await Test.createTestingModule({
    providers: [
      UsersService,
      { provide: USER_REPOSITORY, useValue: mockUserRepo },
    ],
  }).compile();
  const service = module.get(UsersService);

  // users.e2e-spec.ts
  const app = (await Test.createTestingModule({ imports: [AppModule] })
    .compile()
    .createNestApplication());
  await app.init();
  await request(app.getHttpServer()).get('/users/1').expect(200);
  ```
- **Why:** Unit tests are fast and precise; e2e tests validate the full HTTP stack including
  guards and interceptors.

## File Structure (audit reference)

```
src/
├── app.module.ts           # Root module — imports all feature modules
├── main.ts                 # Bootstrap, global pipes/guards/filters
├── shared/
│   ├── shared.module.ts
│   ├── logger/
│   └── config/
└── users/
    ├── users.module.ts
    ├── users.controller.ts
    ├── users.service.ts
    ├── users.repository.ts
    ├── dto/
    │   ├── create-user.dto.ts
    │   └── user-response.dto.ts
    └── entities/
        └── user.entity.ts
```

## Common Pitfalls

- **Circular module imports** — if Module A imports Module B and vice versa, use
  `forwardRef(() => ModuleB)`. Better: extract the shared dependency into `SharedModule`.
- **`@Injectable()` on everything** — only providers that are injected need the decorator.
  Plain utility classes do not.
- **Business logic in controllers** — controllers should be thin. If a controller method is
  longer than ~10 lines, move logic to the service.
- **Not setting `whitelist: true` on ValidationPipe** — without it, extra properties pass
  through to the service and potentially to the database.
- **Global guards blocking the health endpoint** — always add a `@Public()` (or equivalent
  skip-auth decorator) on health check routes.
- **Importing `TypeOrmModule` directly in feature modules** — use `TypeOrmModule.forFeature()`
  with just the entities the module needs, not the root import.
- **Skipping `async/await` in lifecycle hooks** — `onModuleInit`, `onApplicationShutdown` are
  async; forgetting `await` on DB setup leads to race conditions at startup.
