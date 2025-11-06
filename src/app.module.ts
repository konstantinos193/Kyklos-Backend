import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { StudentsModule } from './students/students.module';
import { BlogModule } from './blog/blog.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { ContactModule } from './contact/contact.module';
import { ExamMaterialsModule } from './exam-materials/exam-materials.module';
import { TeacherPermissionsModule } from './teacher-permissions/teacher-permissions.module';
import { HealthModule } from './health/health.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || '', {
      dbName: process.env.MONGODB_DB_NAME || 'kyklos_frontistirio',
    }),
    DatabaseModule,
    CacheModule,
    EmailModule,
    AuthModule,
    AdminModule,
    StudentsModule,
    BlogModule,
    NewsletterModule,
    ContactModule,
    ExamMaterialsModule,
    TeacherPermissionsModule,
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

