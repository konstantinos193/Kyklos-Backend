import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { StudentsModule } from './students/students.module';
import { BlogModule } from './blog/blog.module';
import { NewsModule } from './news/news.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { ContactModule } from './contact/contact.module';
import { ExamMaterialsModule } from './exam-materials/exam-materials.module';
import { TeacherPermissionsModule } from './teacher-permissions/teacher-permissions.module';
import { HealthModule } from './health/health.module';
import { EmailModule } from './email/email.module';
import { PanhellenicArchiveModule } from './panhellenic-archive/panhellenic-archive.module';
import { ExercisesModule } from './exercises/exercises.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      expandVariables: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || '',
        dbName: configService.get<string>('MONGODB_DB_NAME') || 'kyklos_frontistirio',
      }),
      inject: [ConfigService],
    }),
    DatabaseModule,
    CacheModule,
    EmailModule,
    AuthModule,
    AdminModule,
    StudentsModule,
    BlogModule,
    NewsModule,
    NewsletterModule,
    ContactModule,
    ExamMaterialsModule,
    TeacherPermissionsModule,
    HealthModule,
    PanhellenicArchiveModule,
    ExercisesModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

